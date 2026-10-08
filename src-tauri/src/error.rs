use serde::Serialize;

/// IPC 错误码表
pub mod codes {
    pub const NOT_FOUND: &str = "NOT_FOUND";
    pub const VALIDATION: &str = "VALIDATION";
    pub const UNIQUE_VIOLATION: &str = "UNIQUE_VIOLATION";
    pub const FK_VIOLATION: &str = "FK_VIOLATION";
    pub const MIGRATION_FAILED: &str = "MIGRATION_FAILED";
    pub const DB_LOCKED: &str = "DB_LOCKED";
    pub const INTERNAL: &str = "INTERNAL";
}

/// 跨 IPC 边界的错误结构（序列化为 {code,message,detail?}）
#[derive(Debug, Serialize)]
pub struct IpcError {
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<serde_json::Value>,
}

impl IpcError {
    /// 构造错误（无 detail）
    pub fn new(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self { code: code.into(), message: message.into(), detail: None }
    }
    /// 未找到（读/更新/删除影响行数为 0）
    pub fn not_found(what: &str) -> Self {
        Self::new(codes::NOT_FOUND, format!("{what} not found"))
    }
}

/// sqlx 错误 → 错误码映射
impl From<sqlx::Error> for IpcError {
    fn from(e: sqlx::Error) -> Self {
        if let sqlx::Error::Database(db) = &e {
            match db.code().as_deref() {
                Some("2067") | Some("1555") => return IpcError::new(codes::UNIQUE_VIOLATION, e.to_string()),
                Some("787") => return IpcError::new(codes::FK_VIOLATION, e.to_string()),
                Some("5") | Some("6") => return IpcError::new(codes::DB_LOCKED, e.to_string()),
                _ => {}
            }
        }
        IpcError::new(codes::INTERNAL, e.to_string())
    }
}
