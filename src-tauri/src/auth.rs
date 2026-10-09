use reqwest::header::{HeaderMap, HeaderName, HeaderValue};
use crate::error::{codes, IpcError};

#[derive(Clone, serde::Deserialize)]
pub struct AuthSpec {
    pub key_ref_provider: String,
    pub key_ref_label: String,
    pub header: String,
    pub prefix: String,
}

const AUTH_DENYLIST: [&str; 4] = ["authorization", "x-api-key", "proxy-authorization", "api-key"];

/// 合成请求头：丢弃前端授权类头；auth 存在则读取密钥链并覆盖注入（Key 不入日志）
pub fn compose_headers(
    frontend: Vec<(String, String)>,
    auth: Option<(AuthSpec, String)>,
) -> Result<HeaderMap, IpcError> {
    let mut map = HeaderMap::new();
    for (k, v) in frontend {
        if AUTH_DENYLIST.contains(&k.to_ascii_lowercase().as_str()) {
            continue;
        }
        map.insert(
            HeaderName::from_bytes(k.as_bytes())
                .map_err(|_| IpcError::new(codes::VALIDATION, "invalid header name"))?,
            HeaderValue::from_str(&v)
                .map_err(|_| IpcError::new(codes::VALIDATION, "invalid header value"))?,
        );
    }
    if let Some((spec, key)) = auth {
        let value = format!("{}{}", spec.prefix, key);
        map.insert(
            HeaderName::from_bytes(spec.header.as_bytes())
                .map_err(|_| IpcError::new(codes::VALIDATION, "invalid auth header name"))?,
            HeaderValue::from_str(&value)
                .map_err(|_| IpcError::new(codes::VALIDATION, "invalid auth header value"))?,
        );
    }
    Ok(map)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn compose_headers_drops_frontend_auth_and_injects() {
        let fe = vec![
            ("authorization".to_string(), "Bearer LEAK".to_string()),
            ("x-api-key".to_string(), "LEAK".to_string()),
            ("Content-Type".to_string(), "application/json".to_string()),
        ];
        let spec = AuthSpec {
            key_ref_provider: "openai".into(),
            key_ref_label: "default".into(),
            header: "Authorization".into(),
            prefix: "Bearer ".into(),
        };
        let map = compose_headers(fe, Some((spec, "SECRET".into()))).unwrap();
        assert_eq!(map.get("content-type").unwrap(), "application/json");
        assert_eq!(map.get("authorization").unwrap(), "Bearer SECRET");
        assert_ne!(map.get("authorization").unwrap(), "Bearer LEAK");
        assert!(!map.contains_key("x-api-key"));
    }

    #[test]
    fn compose_headers_without_auth_keeps_non_key_headers() {
        let fe = vec![
            ("x-api-key".to_string(), "LEAK".to_string()),
            ("Accept".to_string(), "text/event-stream".to_string()),
        ];
        let map = compose_headers(fe, None).unwrap();
        assert!(map.contains_key("accept"));
        assert!(!map.contains_key("x-api-key"));
    }
}
