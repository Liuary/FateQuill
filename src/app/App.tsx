import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/ui/LanguageSwitcher";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { WorkspaceLayout } from "@/features/editor/WorkspaceLayout";
import { ResearchWorkbench } from "@/features/research/ResearchWorkbench";
import { BenchPanel } from "@/features/editor/perf/BenchPanel";

function App() {
  const { t } = useTranslation();
  const [view, setView] = useState<"workspace" | "settings" | "research">("workspace");
  return (
    <div className="flex h-screen flex-col">
      <header className="border-border flex items-center justify-between gap-2 border-b px-4 py-2">
        <h1 className="text-lg font-semibold">{t("appName")}</h1>
        <div className="flex items-center gap-2">
          <Button
            variant={view === "workspace" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("workspace")}
          >
            {t("editor:workspace")}
          </Button>
          <Button
            variant={view === "research" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("research")}
          >
            {t("research:tab")}
          </Button>
          <Button
            variant={view === "settings" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("settings")}
          >
            {t("settings:title")}
          </Button>
          <LanguageSwitcher />
        </div>
      </header>
      <div className="min-h-0 flex-1">
        {view === "workspace" ? (
          <WorkspaceLayout />
        ) : view === "settings" ? (
          <SettingsPage />
        ) : (
          <ResearchWorkbench />
        )}
      </div>
      {import.meta.env.DEV && <BenchPanel />}
    </div>
  );
}

export default App;
