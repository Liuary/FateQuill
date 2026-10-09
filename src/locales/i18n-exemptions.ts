/**
 * i18n **豁免清单**（stage-12 T6，英文收口）
 *
 * 口径（**严格**）：
 * - 键完整性以 **`en ⊇ zh-CN`** 为默认要求；**UI 标签一律不得豁免**（缺失即测试失败）；
 * - 仅两类可入本清单：① **测试夹具**（非 UI、界面不可达）；② **内容类**（创作内容 / 古籍白文，允许保留中文值）；
 * - 每条**必须写明理由**；豁免条目须在 `zh-CN` 中**真实存在**（防陈旧豁免）；豁免总数**≤ 3**（超过须评审）。
 *
 * 本文件由 `src/locales/i18n-completeness.test.ts` 消费。
 */

/** 键豁免：`zh-CN` 有、`en` **允许缺**的键路径 */
export interface KeyExemption {
  /** 扁平键路径（点分，如 `common.onlyZh`） */
  path: string;
  /** 理由（**必填**） */
  reason: string;
}

/**
 * 键路径豁免清单（**只为「非 UI」键开口子**）。
 */
export const EXEMPT_KEY_PATHS: KeyExemption[] = [
  {
    path: "common.onlyZh",
    reason:
      "**测试夹具**：`src/app/i18n.test.ts` 用它断言「en 缺失 → 回退 zh-CN」；若翻译该键则回退测试失效。**非 UI 标签**（界面不可达），故可豁免。",
  },
];

/** 值豁免：键**仍必须存在**，但允许 `en` 值保留中文（内容类白文） */
export interface ValueExemption {
  /** 命名空间前缀（点分） */
  prefix: string;
  reason: string;
}

/**
 * 值豁免清单（**不放松键断言**，仅登记「值不译」的内容类范围）。
 *
 * 说明（**如实**）：当前经文（卦爻辞）与课体名目（月将 / 天将 / 课体）位于**静态数据域**
 * （`src/data/iching`、`src/data/liuren`），**不经 i18n**；故当前**无命中的值豁免键**，
 * 此处为**机制预留**：若后续把白文搬入 i18n，按其前缀登记即可，不必新增豁免机制。
 */
export const VALUE_EXEMPTIONS: ValueExemption[] = [
  {
    prefix: "iching.",
    reason:
      "易经白文（卦辞 / 爻辞）属古籍原文，**不译**；键必须存在（当前白文在静态数据域，未入 i18n）。",
  },
  {
    prefix: "liuren.",
    reason:
      "大六壬白文名目（月将 / 天将 / 课体）属传统称谓，**不译**；键必须存在（当前在静态数据域）。",
  },
];

/** 键是否豁免（允许 `en` 缺） */
export function isExemptKey(path: string): boolean {
  return EXEMPT_KEY_PATHS.some((entry) => entry.path === path);
}

/** 键是否属「值豁免」范围（**键仍需存在**，仅登记值策略） */
export function isValueExempt(path: string): boolean {
  return VALUE_EXEMPTIONS.some((entry) => path.startsWith(entry.prefix));
}
