import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ping } from "@/ipc/ping";

function App() {
  const [result, setResult] = useState("");

  async function handlePing() {
    setResult(await ping());
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <Button onClick={handlePing}>Ping</Button>
      <p>{result}</p>
    </main>
  );
}

export default App;
