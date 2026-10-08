import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/ui/LanguageSwitcher";
import { ping } from "@/ipc/ping";

function App() {
  const { t } = useTranslation();
  const [result, setResult] = useState("");
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-semibold">{t("appName")}</h1>
      <LanguageSwitcher />
      <Button onClick={async () => setResult(await ping())}>{t("ping")}</Button>
      <p>{result}</p>
    </main>
  );
}

export default App;
