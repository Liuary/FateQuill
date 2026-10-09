use crate::error::{codes, IpcError};

/// 条目命名约定：service=`fatequill`，account=`{provider}/{label}`（plan §「密钥链」）
pub fn entry(provider: &str, label: &str) -> Result<keyring::Entry, IpcError> {
    keyring::Entry::new("fatequill", &format!("{provider}/{label}"))
        .map_err(|_| IpcError::new(codes::INTERNAL, "keyring unavailable"))
}

/// 读取密钥（仅供 Rust 内部，如 http_stream 注入授权头；不下发前端）
pub fn get(provider: &str, label: &str) -> Result<String, IpcError> {
    entry(provider, label)?
        .get_password()
        .map_err(|_| IpcError::new(codes::NOT_FOUND, "api key not found"))
}

pub fn set(provider: &str, label: &str, key: &str) -> Result<(), IpcError> {
    entry(provider, label)?
        .set_password(key)
        .map_err(|_| IpcError::new(codes::INTERNAL, "keyring write failed"))
}

pub fn delete(provider: &str, label: &str) -> Result<(), IpcError> {
    entry(provider, label)?
        .delete_credential()
        .map_err(|_| IpcError::new(codes::INTERNAL, "keyring delete failed"))
}

/// 是否存在对应密钥（不发回 Key 本身）
pub fn exists(provider: &str, label: &str) -> Result<bool, IpcError> {
    match entry(provider, label)?.get_password() {
        Ok(_) => Ok(true),
        Err(keyring::Error::NoEntry) => Ok(false),
        Err(_) => Err(IpcError::new(codes::INTERNAL, "keyring read failed")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn unique_suffix() -> String {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        format!("{}-{nanos}", std::process::id())
    }

    /// roundtrip：set → get → exists → delete → !exists（测后清理真实凭据）
    #[test]
    fn keyring_roundtrip_set_get_delete() {
        let label = format!("test-{}", unique_suffix());
        match set("test-provider", &label, "secret-value") {
            Ok(()) => {
                assert_eq!(get("test-provider", &label).unwrap(), "secret-value");
                assert!(exists("test-provider", &label).unwrap());
                delete("test-provider", &label).unwrap();
                assert!(!exists("test-provider", &label).unwrap(), "删除后应不存在");
            }
            Err(e) => {
                // 某些环境无可用平台密钥后端 → 跳过（不使测试失败）
                eprintln!("keyring backend unavailable, skip roundtrip: {}", e.message);
            }
        }
    }
}
