use serde_json::Value;

/// 按格式计算字数（单位：非空白字符）
/// 局限（REV-011）：html 分支为简易去标签 + 常用实体解码，仍为**近似值**
/// （未处理属性值内 `>`、`<script>/<style>` 文本与未知实体）；精确字数后续引入解析器。
pub fn count_words(content: &str, content_format: &str) -> i64 {
    match content_format {
        "html" => count_non_ws(&decode_entities(&strip_html_tags(content))),
        "tiptap-json" => count_non_ws(&extract_tiptap_text(content)),
        _ => count_non_ws(content),
    }
}

fn count_non_ws(s: &str) -> i64 {
    s.chars().filter(|c| !c.is_whitespace()).count() as i64
}

/// 解码常用 HTML 实体（REV-011 增强；`&nbsp;` 计 0 字）
pub fn decode_entities(s: &str) -> String {
    s.replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
}

/// 去除 HTML 标签（简易状态机，尖括号内跳过）
pub fn strip_html_tags(html: &str) -> String {
    let mut out = String::new();
    let mut in_tag = false;
    for c in html.chars() {
        match c {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => out.push(c),
            _ => {}
        }
    }
    out
}

/// 遍历 tiptap ProseMirror JSON 的 text 节点
pub fn extract_tiptap_text(json: &str) -> String {
    fn walk(v: &Value, out: &mut String) {
        match v {
            Value::Object(map) => {
                if map.get("type").and_then(|t| t.as_str()) == Some("text") {
                    if let Some(t) = map.get("text").and_then(|t| t.as_str()) {
                        out.push_str(t);
                    }
                }
                if let Some(children) = map.get("content").and_then(|c| c.as_array()) {
                    for c in children {
                        walk(c, out);
                    }
                }
            }
            Value::Array(arr) => {
                for c in arr {
                    walk(c, out);
                }
            }
            _ => {}
        }
    }
    let mut out = String::new();
    if let Ok(v) = serde_json::from_str::<Value>(json) {
        walk(&v, &mut out);
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn word_count_html_strips_tags_and_decodes_entities() {
        // "<p>a &amp; b</p>" → 去标签 "a & b" → 解码 "a & b" → 非空白 3
        assert_eq!(count_words("<p>a &amp; b</p>", "html"), 3);
        // 标签内空白不计；`&nbsp;` 解码为空格不计
        assert_eq!(count_words("<div>你好&nbsp;世界</div>", "html"), 4);
        assert_eq!(count_words("", "html"), 0);
    }

    #[test]
    fn word_count_tiptap_json_walks_text_nodes() {
        let json = r#"{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"你好"},{"type":"text","text":"世界"}]}]}"#;
        assert_eq!(count_words(json, "tiptap-json"), 4);
        assert_eq!(count_words("not-json", "tiptap-json"), 0);
    }

    #[test]
    fn word_count_plaintext_counts_non_ws() {
        assert_eq!(count_words("hello world", "plaintext"), 10);
        assert_eq!(count_words("  a \n b \t c ", "plaintext"), 3);
        assert_eq!(count_words("", "plaintext"), 0);
    }
}
