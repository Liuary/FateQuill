/**
 * i18n **键完整性**测试（stage-12 T6，英文收口）
 *
 * 断言 **每命名空间 `en ⊇ zh-CN`**（**UI 标签一律不得缺失**；仅 `i18n-exemptions.ts` 显式登记的
 * 「测试夹具 / 内容类」可豁免），并断言 **zh-CN / en 命名空间一一对应**。
 * 随 `pnpm test` 执行 → **CI 防回归**。
 *
 * 实现说明：经 Vite `import.meta.glob(...?raw)` 加载语言 JSON（**不引入 node fs**，与项目既有 `?raw` 范式一致）。
 */

import { describe, expect, it } from "vitest";
import { EXEMPT_KEY_PATHS, isExemptKey, isValueExempt } from "./i18n-exemptions";

/** 语言 JSON 原文（键形如 `./zh-CN/common.json`） */
const RAW = import.meta.glob("./*/*.json", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

/** `./zh-CN/common.json` → `zh-CN` */
export function langOf(path: string): string {
  return path.split("/")[1];
}

/** `./zh-CN/common.json` → `common` */
export function namespaceOf(path: string): string {
  return path.split("/")[2].replace(/\.json$/, "");
}

/** 递归求扁平键路径集合（点分） */
export function flattenKeys(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return prefix ? [prefix] : [];
  }
  const out: string[] = [];
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child !== null && typeof child === "object" && !Array.isArray(child)) {
      out.push(...flattenKeys(child, path));
    } else {
      out.push(path);
    }
  }
  return out;
}

/** 命名空间清单（排序） */
export function listNamespaces(lang: string): string[] {
  return Object.keys(RAW)
    .filter((path) => langOf(path) === lang)
    .map(namespaceOf)
    .sort();
}

/** 读取某语言的某命名空间（缺失 → 抛错，避免静默通过） */
export function loadNamespace(lang: string, namespace: string): Record<string, unknown> {
  const raw = RAW[`./${lang}/${namespace}.json`];
  if (raw === undefined) {
    throw new Error(`命名空间文件缺失：src/locales/${lang}/${namespace}.json`);
  }
  return JSON.parse(raw) as Record<string, unknown>;
}

/**
 * 核心判定：返回 `zh` 有、`en` 缺**且未豁免**的键路径（空数组 = 通过）；
 * 豁免清单以 `命名空间.键路径` **全限定**形式登记。
 */
export function missingKeys(
  namespace: string,
  zh: Record<string, unknown>,
  en: Record<string, unknown>,
  exempt: (path: string) => boolean = isExemptKey,
): string[] {
  const enKeys = flattenKeys(en);
  return flattenKeys(zh).filter(
    (path) => !enKeys.includes(path) && !exempt(`${namespace}.${path}`),
  );
}

describe("i18n 键完整性（en ⊇ zh-CN；stage-12 T6）", () => {
  const zhNamespaces = listNamespaces("zh-CN");
  const enNamespaces = listNamespaces("en");

  it("命名空间集合一致（zh-CN 与 en 一一对应）", () => {
    expect(enNamespaces).toEqual(zhNamespaces);
  });

  it("命名空间数量 = 14（含新 UI `liuren` / `autopilot`）", () => {
    expect(zhNamespaces).toHaveLength(14);
    expect(zhNamespaces).toContain("liuren");
    expect(zhNamespaces).toContain("autopilot");
  });

  it("每命名空间 `en ⊇ zh-CN`（**UI 标签不得缺失**；豁免除外）", () => {
    const failures: string[] = [];
    for (const namespace of zhNamespaces) {
      const missing = missingKeys(
        namespace,
        loadNamespace("zh-CN", namespace),
        loadNamespace("en", namespace),
      );
      if (missing.length > 0) {
        failures.push(`${namespace}: ${missing.join(", ")}`); // 缺失即列出，便于定位
      }
    }
    expect(failures).toEqual([]);
  });

  it("新 UI 命名空间 `liuren` / `autopilot` 键完全对齐（无豁免）", () => {
    for (const namespace of ["liuren", "autopilot"]) {
      expect(
        missingKeys(namespace, loadNamespace("zh-CN", namespace), loadNamespace("en", namespace)),
      ).toEqual([]);
    }
  });

  it("豁免登记卫生：条目在 `zh-CN` 中真实存在、理由非空、总数 ≤ 3（**UI 标签不得豁免**）", () => {
    expect(EXEMPT_KEY_PATHS.length).toBeLessThanOrEqual(3);
    const zhAll = new Set(
      zhNamespaces.flatMap((namespace) => {
        const [lang, file] = [`zh-CN`, namespace];
        return flattenKeys(loadNamespace(lang, file)).map((path) => `${namespace}:${path}`);
      }),
    );
    for (const entry of EXEMPT_KEY_PATHS) {
      const [namespace, ...rest] = entry.path.split(".");
      expect(entry.reason.length).toBeGreaterThan(0); // 理由必填
      expect(zhAll.has(`${namespace}:${rest.join(".")}`)).toBe(true); // 防陈旧豁免
    }
  });

  it("值豁免仅登记**键已存在**的内容类范围（不放松键断言）", () => {
    for (const namespace of zhNamespaces) {
      const enKeys = flattenKeys(loadNamespace("en", namespace));
      for (const path of flattenKeys(loadNamespace("zh-CN", namespace))) {
        if (isValueExempt(`${namespace}.${path}`)) {
          // 命中值豁免的键（内容类）：**键仍须在 en 存在**
          expect(enKeys).toContain(path);
        }
      }
    }
  });

  it("**负向防回归**：构造样本缺 en 键 → 检出缺失（断言机制有效）", () => {
    expect(missingKeys("demo", { a: "x", b: { c: "y" } }, { a: "x" })).toEqual(["b.c"]);
    expect(missingKeys("demo", { a: "x" }, { a: "x" })).toEqual([]); // 完整 → 通过
    // 豁免生效：仅当路径被显式登记（全限定）
    expect(missingKeys("demo", { a: "x" }, {}, (path) => path === "demo.a")).toEqual([]);
  });
});
