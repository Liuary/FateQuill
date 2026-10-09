use crate::error::{codes, IpcError};

/// 条目命名约定：service=`fatequill`，account=`{provider}/{label}`（plan §「密钥链」）
pub fn entry(provider: &str, label: &str) -> Result<keyring::Entry, IpcError> {
    keyring::Entry::new("fatequill", &format!("{provider}/{label}"))
        .map_err(|_| IpcError::new(codes::INTERNAL, "keyring unavailable"))
}

pub fn get(provider: &str, label: &str) -> Result<String, IpcError> {
    entry(provider, label)?
        .get_password()
        .map_err(|_| IpcError::new(codes::NOT_FOUND, "api key not found"))
}

// 预留：密钥写入/删除（供后续「模型配置」命令使用，stage-03 op-004/005）
#[allow(dead_code)]
pub fn set(provider: &str, label: &str, key: &str) -> Result<(), IpcError> {
    entry(provider, label)?
        .set_password(key)
        .map_err(|_| IpcError::new(codes::INTERNAL, "keyring write failed"))
}

// 预留：密钥删除（供后续「模型配置」命令使用，stage-03 op-004/005）
#[allow(dead_code)]
pub fn delete(provider: &str, label: &str) -> Result<(), IpcError> {
    entry(provider, label)?
        .delete_credential()
        .map_err(|_| IpcError::new(codes::INTERNAL, "keyring delete failed"))
}
