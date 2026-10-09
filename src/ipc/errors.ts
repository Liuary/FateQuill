export const IpcErrorCode = {
  NotFound: "NOT_FOUND",
  Validation: "VALIDATION",
  UniqueViolation: "UNIQUE_VIOLATION",
  FkViolation: "FK_VIOLATION",
  MigrationFailed: "MIGRATION_FAILED",
  DbLocked: "DB_LOCKED",
  Timeout: "TIMEOUT", // 与 Rust codes::TIMEOUT 对齐（REV-015）
  Internal: "INTERNAL",
} as const;
export type IpcErrorCode = (typeof IpcErrorCode)[keyof typeof IpcErrorCode];

export interface IpcErrorShape {
  code: string;
  message: string;
  detail?: unknown;
}

/** 前端消费的 IPC 错误（归一化 Rust 端 {code,message,detail?}） */
export class IpcError extends Error {
  readonly code: string;
  readonly detail?: unknown;
  constructor(shape: IpcErrorShape) {
    super(shape.message);
    this.name = "IpcError";
    this.code = shape.code;
    this.detail = shape.detail;
  }
}

export function parseIpcError(err: unknown): IpcError {
  if (err && typeof err === "object" && "code" in err && "message" in err) {
    const e = err as IpcErrorShape;
    return new IpcError({ code: String(e.code), message: String(e.message), detail: e.detail });
  }
  return new IpcError({
    code: IpcErrorCode.Internal,
    message: err instanceof Error ? err.message : String(err),
  });
}
