import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export interface NewNovelPanelProps {
  onCreate: (title: string, synopsis?: string) => Promise<unknown>;
}

/** 空态：新建作品 */
export function NewNovelPanel({ onCreate }: NewNovelPanelProps) {
  const { t } = useTranslation("editor");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!title.trim()) return;
    setBusy(true);
    try {
      await onCreate(title, "");
    } finally {
      setBusy(false);
    }
  }

  return (
    // `min-h-full`（**不再用 100vh**）：适配父容器（flex 内容区），卡片居中且不溢出
    <div className="flex min-h-full items-center justify-center overflow-auto p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t("emptyNovels")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            {t("novelTitle")}
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <Button disabled={busy} onClick={submit}>
            {t("create")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
