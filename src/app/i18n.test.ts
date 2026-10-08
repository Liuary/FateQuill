import { describe, expect, it } from "vitest";
import i18n from "@/app/i18n";

describe("i18n fallback", () => {
  it("英文缺失键回退中文", async () => {
    await i18n.changeLanguage("en");
    expect(i18n.t("onlyZh")).toBe("仅中文示例");
  });
  it("中文默认", async () => {
    await i18n.changeLanguage("zh-CN");
    expect(i18n.t("appName")).toBe("命笔");
  });
});
