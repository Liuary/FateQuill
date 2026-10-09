/**
 * 合规词表 / 正则规则载体（stage-06 T2）
 *
 * 职责：提供结构化合规类目与规则（词表 / 正则）、命中扫描与类目权重。
 * **无需 Token / Provider**（纯本地规则引擎）。
 *
 * 覆盖范围声明：内置词表为**示意性初始集，覆盖范围有限**，需随规范演进持续更新；
 * 版本常量 `COMPLIANCE_RULES_VERSION` 随词表变更递增。
 */

/** 合规规则版本（随词表变更递增） */
export const COMPLIANCE_RULES_VERSION = "0.1.0";

/** 合规类目 */
export type ComplianceCategory = "politics" | "porn" | "violence" | "ad" | "values";

/** 单条合规规则：id 唯一；pattern 为正则源字符串（大小写不敏感） */
export interface ComplianceRule {
  id: string;
  category: ComplianceCategory;
  pattern: string;
  note: string;
}

/** 单次命中 */
export interface ComplianceHit {
  ruleId: string;
  category: ComplianceCategory;
  note: string;
  match: string;
}

/** 类目扣分权重（单条规则命中一次计一次，同规则去重） */
export const CATEGORY_WEIGHT: Record<ComplianceCategory, number> = {
  politics: 40,
  porn: 30,
  violence: 25,
  ad: 15,
  values: 20,
};

/**
 * 内置初始词表（**覆盖范围有限**；可配置 / 可更新以应对规范演进）。
 * 仅作示意，实际审核需人工复核（合规低分仅人工裁决，不自动重写）。
 */
export const COMPLIANCE_RULES: ComplianceRule[] = [
  // 涉政
  {
    id: "politics-001",
    category: "politics",
    pattern: "(推翻|颠覆)(国家|政权|政府)",
    note: "涉政：颠覆性表述",
  },
  {
    id: "politics-002",
    category: "politics",
    pattern: "(台独|港独|疆独|藏独)",
    note: "涉政：分裂主张",
  },
  // 色情
  {
    id: "porn-001",
    category: "porn",
    pattern: "(嫖娼|卖淫|强奸|轮奸)",
    note: "色情：性暴力 / 买卖",
  },
  { id: "porn-002", category: "porn", pattern: "(裸体|脱光|下体|性器官)", note: "色情：露骨描写" },
  // 暴力
  {
    id: "violence-001",
    category: "violence",
    pattern: "(肢解|虐杀|开膛|斩首)",
    note: "暴力：过度血腥",
  },
  {
    id: "violence-002",
    category: "violence",
    pattern: "(自杀|自残)(方法|教程|方式)",
    note: "暴力：自伤细节",
  },
  // 广告
  {
    id: "ad-001",
    category: "ad",
    pattern: "(点击|扫描)[^。\\n]{0,6}(二维码|链接)",
    note: "广告：导流话术",
  },
  { id: "ad-002", category: "ad", pattern: "(加|联系)(微信|QQ|公众号)", note: "广告：私域导流" },
  // 价值观
  {
    id: "values-001",
    category: "values",
    pattern: "(读书无用|努力没有意义)",
    note: "价值观：消极导向",
  },
  {
    id: "values-002",
    category: "values",
    pattern: "(骗保|逃税)(技巧|办法)",
    note: "价值观：违法引导",
  },
];

/** 扫描文本命中（同规则多次命中保留全部 match；非法正则跳过不阻断） */
export function scanCompliance(
  text: string,
  rules: ComplianceRule[] = COMPLIANCE_RULES,
): ComplianceHit[] {
  const hits: ComplianceHit[] = [];
  for (const rule of rules) {
    let re: RegExp;
    try {
      re = new RegExp(rule.pattern, "gi");
    } catch {
      // 非法正则：跳过该规则（不阻断整体扫描）
      continue;
    }
    for (const m of text.matchAll(re)) {
      hits.push({ ruleId: rule.id, category: rule.category, note: rule.note, match: m[0] });
    }
  }
  return hits;
}
