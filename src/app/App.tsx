import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/ui/LanguageSwitcher";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { ping } from "@/ipc/ping";

function App() {
  const { t } = useTranslation();
  const [result, setResult] = useState("");
  const [view, setView] = useState<"home" | "settings">("home");
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">{t("appName")}</h1>
      <LanguageSwitcher />
      <div className="flex gap-2">
        <Button
          variant={view === "home" ? "default" : "outline"}
          size="sm"
          onClick={() => setView("home")}
        >
          {t("settings:home")}
        </Button>
        <Button
          variant={view === "settings" ? "default" : "outline"}
          size="sm"
          onClick={() => setView("settings")}
        >
          {t("settings:title")}
        </Button>
      </div>
      {view === "home" ? (
        <>
          <Button onClick={async () => setResult(await ping())}>{t("ping")}</Button>
          <p>{result}</p>
        </>
      ) : (
        <SettingsPage />
      )}
    </main>
  );
}

export default App;
