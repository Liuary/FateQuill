use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use serde::Serialize;
use tauri::ipc::Channel;
use crate::error::{codes, IpcError};

/// SSE 中继事件（前端 StreamEvent TS 契约的镜像）
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type")]
pub enum StreamEvent {
    Chunk {
        data: String,
    },
    Done,
    Error {
        code: String,
        message: String,
        #[serde(rename = "statusCode", skip_serializing_if = "Option::is_none")]
        status_code: Option<u16>,
    },
}

/// 事件接收端抽象（生产为 Tauri Channel；测试为内存 sink，便于单元测试）
pub trait EventSink: Send + 'static {
    fn send(&self, event: StreamEvent) -> bool;
}

impl EventSink for Channel<StreamEvent> {
    fn send(&self, event: StreamEvent) -> bool {
        Channel::send(self, event).is_ok()
    }
}

/// 仅允许 https（REV-009①）
pub fn ensure_https(url: &str) -> Result<(), IpcError> {
    if url.starts_with("https://") {
        Ok(())
    } else {
        Err(IpcError::new(codes::VALIDATION, "only https:// URLs are allowed"))
    }
}

/// 复用客户端：connect 10s / read 60s
pub fn client() -> reqwest::Client {
    reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(10))
        .read_timeout(Duration::from_secs(60))
        .build()
        .expect("build reqwest client")
}

/// 错误脱敏：仅通用文案，不含 URL/headers/body/Key
fn err_event(e: &reqwest::Error) -> StreamEvent {
    if e.is_timeout() {
        StreamEvent::Error {
            code: codes::TIMEOUT.into(),
            message: "request timed out".into(),
            status_code: None,
        }
    } else {
        StreamEvent::Error {
            code: codes::INTERNAL.into(),
            message: "upstream request failed".into(),
            status_code: e.status().map(|s| s.as_u16()),
        }
    }
}

/// 中继核心：透明转发 SSE 事件块（按空行边界切分），结束发 Done，出错发 Error
pub async fn relay<S: EventSink>(
    client: &reqwest::Client,
    url: &str,
    headers: reqwest::header::HeaderMap,
    body: String,
    sink: S,
) {
    let resp = match client.post(url).headers(headers).body(body).send().await {
        Ok(r) => r,
        Err(e) => {
            sink.send(err_event(&e));
            return;
        }
    };
    if !resp.status().is_success() {
        let code = resp.status().as_u16();
        sink.send(StreamEvent::Error {
            code: codes::INTERNAL.into(),
            message: format!("upstream status {code}"),
            status_code: Some(code),
        });
        return;
    }
    let mut resp = resp;
    let mut buf: Vec<u8> = Vec::new(); // 归一化（LF）后的缓冲区
    let mut carry_cr = false; // 跨块 \r 状态（REV-012：兼容 \r\n\r\n / \r\r）
    loop {
        match resp.chunk().await {
            Ok(Some(chunk)) => {
                for &b in chunk.iter() {
                    if carry_cr {
                        buf.push(b'\n'); // \r\n / \r 归一为 \n
                        carry_cr = false;
                        if b == b'\n' {
                            continue;
                        }
                    }
                    if b == b'\r' {
                        carry_cr = true;
                        continue;
                    }
                    buf.push(b);
                }
                while let Some(pos) = buf.windows(2).position(|w| w == b"\n\n") {
                    let block: Vec<u8> = buf.drain(..pos + 2).collect();
                    if !sink.send(StreamEvent::Chunk {
                        data: String::from_utf8_lossy(&block).to_string(),
                    }) {
                        return;
                    }
                }
            }
            Ok(None) => {
                if carry_cr {
                    buf.push(b'\n');
                }
                if !buf.is_empty() {
                    // 冲刷无空行终止的末块，避免数据滞留丢失
                    let _ = sink.send(StreamEvent::Chunk {
                        data: String::from_utf8_lossy(&buf).to_string(),
                    });
                }
                sink.send(StreamEvent::Done);
                return;
            }
            Err(e) => {
                sink.send(err_event(&e));
                return;
            }
        }
    }
}

/// 流任务注册表（request_id → AbortHandle）
#[derive(Default)]
pub struct StreamRegistry {
    pub handles: tokio::sync::Mutex<HashMap<String, tokio::task::AbortHandle>>,
}
pub type SharedStreamRegistry = Arc<StreamRegistry>;

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex as StdMutex;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpListener;

    #[derive(Clone, Default)]
    struct MemSink(Arc<StdMutex<Vec<StreamEvent>>>);
    impl EventSink for MemSink {
        fn send(&self, event: StreamEvent) -> bool {
            self.0.lock().unwrap().push(event);
            true
        }
    }
    impl MemSink {
        fn events(&self) -> Vec<StreamEvent> {
            self.0.lock().unwrap().clone()
        }
        fn chunks(&self) -> Vec<String> {
            self.0
                .lock()
                .unwrap()
                .iter()
                .filter_map(|e| match e {
                    StreamEvent::Chunk { data } => Some(data.clone()),
                    _ => None,
                })
                .collect()
        }
        fn last_error_code(&self) -> Option<String> {
            self.0.lock().unwrap().iter().rev().find_map(|e| match e {
                StreamEvent::Error { code, .. } => Some(code.clone()),
                _ => None,
            })
        }
        fn is_done(&self) -> bool {
            matches!(self.0.lock().unwrap().last(), Some(StreamEvent::Done))
        }
    }

    /// 单次响应：完整 body（含 Content-Length）后可选停滞
    async fn spawn_once(body: String, stall: bool) -> String {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(async move {
            if let Ok((mut socket, _)) = listener.accept().await {
                let mut buf = [0u8; 2048];
                let _ = socket.read(&mut buf).await;
                let head = format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                    body.len()
                );
                let _ = socket.write_all(head.as_bytes()).await;
                let _ = socket.write_all(body.as_bytes()).await;
                let _ = socket.flush().await;
                if stall {
                    tokio::time::sleep(Duration::from_secs(30)).await;
                }
            }
        });
        format!("http://{}", addr)
    }

    #[test]
    fn ensure_https_only_allows_https() {
        assert!(ensure_https("https://api.example.com/v1").is_ok());
        assert!(ensure_https("http://api.example.com/v1").is_err());
        assert!(ensure_https("ftp://api.example.com").is_err());
    }

    #[tokio::test]
    async fn err_event_desensitized() {
        // 构造失败错误（非法 URL）→ err_event 输出通用文案，序列化后不含 URL/Body/Key
        let err = client()
            .post("this is not a url")
            .body("SECRET-BODY")
            .send()
            .await
            .unwrap_err();
        let s = serde_json::to_string(&err_event(&err)).unwrap();
        assert!(!s.contains("SECRET-BODY"));
        assert!(!s.contains("this is not a url"));
        assert!(s.contains("upstream request failed"));
    }

    #[tokio::test]
    async fn relay_splits_events_and_done() {
        let url = spawn_once("data: hello\n\ndata: world\n\n".to_string(), false).await;
        let sink = MemSink::default();
        relay(&client(), &url, reqwest::header::HeaderMap::new(), String::new(), sink.clone()).await;
        let chunks = sink.chunks();
        assert_eq!(chunks.len(), 2);
        assert!(chunks[0].contains("hello"));
        assert!(chunks[1].contains("world"));
        assert!(sink.is_done());
    }

    #[tokio::test]
    async fn relay_crlf_splits_events() {
        let url = spawn_once("data: a\r\n\r\ndata: b\r\n\r\n".to_string(), false).await;
        let sink = MemSink::default();
        relay(&client(), &url, reqwest::header::HeaderMap::new(), String::new(), sink.clone()).await;
        let chunks = sink.chunks();
        assert_eq!(chunks.len(), 2, "CRLF 分隔应切成 2 块");
        assert!(chunks[0].contains('a'));
        assert!(chunks[1].contains('b'));
        assert!(sink.is_done());
    }

    #[tokio::test]
    async fn relay_flushes_trailing_block() {
        // 无空行终止的末块应在 Done 前冲刷
        let url = spawn_once("data: tail".to_string(), false).await;
        let sink = MemSink::default();
        relay(&client(), &url, reqwest::header::HeaderMap::new(), String::new(), sink.clone()).await;
        let chunks = sink.chunks();
        assert_eq!(chunks.len(), 1);
        assert!(chunks[0].contains("tail"));
        assert!(sink.is_done());
    }

    #[tokio::test]
    async fn relay_abort_stops_events() {
        // server 发送一个事件后停滞
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(async move {
            if let Ok((mut socket, _)) = listener.accept().await {
                let mut buf = [0u8; 2048];
                let _ = socket.read(&mut buf).await;
                let _ = socket
                    .write_all(b"HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\n\r\n")
                    .await;
                let _ = socket.write_all(b"data: one\n\n").await;
                let _ = socket.flush().await;
                tokio::time::sleep(Duration::from_secs(30)).await;
            }
        });
        let url = format!("http://{}", addr);
        let sink = MemSink::default();
        let s2 = sink.clone();
        let c = client();
        let handle = tokio::spawn(async move {
            relay(&c, &url, reqwest::header::HeaderMap::new(), String::new(), s2).await;
        });
        tokio::time::sleep(Duration::from_millis(400)).await;
        let n1 = sink.chunks().len();
        assert!(n1 >= 1, "abort 前应至少收到一个块");
        handle.abort();
        tokio::time::sleep(Duration::from_millis(200)).await;
        assert_eq!(sink.chunks().len(), n1, "abort 后不应再收到事件");
    }

    #[tokio::test]
    async fn relay_timeout_maps_to_timeout() {
        // server 发送 headers 后停滞（chunked，无数据）
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(async move {
            if let Ok((mut socket, _)) = listener.accept().await {
                let mut buf = [0u8; 2048];
                let _ = socket.read(&mut buf).await;
                let _ = socket
                    .write_all(
                        b"HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nTransfer-Encoding: chunked\r\n\r\n",
                    )
                    .await;
                let _ = socket.flush().await;
                tokio::time::sleep(Duration::from_secs(30)).await;
            }
        });
        let url = format!("http://{}", addr);
        let c = reqwest::Client::builder()
            .read_timeout(Duration::from_millis(200))
            .build()
            .unwrap();
        let sink = MemSink::default();
        relay(&c, &url, reqwest::header::HeaderMap::new(), String::new(), sink.clone()).await;
        assert_eq!(sink.last_error_code().as_deref(), Some("TIMEOUT"));
    }
}
