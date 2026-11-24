import { useEffect, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { desktopBridge, type DesktopUpdate } from "@/lib/desktop";

export function DesktopUpdates() {
  const [version, setVersion] = useState("");
  const [result, setResult] = useState<DesktopUpdate | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function check() {
    const bridge = desktopBridge();
    if (!bridge?.checkUpdates) {
      setError("Reinstall ptzIP to enable update checks.");
      return;
    }
    setBusy(true);
    setError("");
    try { setResult(await bridge.checkUpdates()); }
    catch { setError("Update check unavailable. Check your internet connection and try again."); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    setVersion(desktopBridge()?.version ?? "");
    if (desktopBridge()?.checkUpdates) void check();
  }, []);
  if (!version) return null;
  return (
    <div className="desktop-updates">
      <span className="font-mono">Installed v{version}</span>
      <Button variant="ghost" size="sm" onClick={() => void check()} disabled={busy} title="Check desktop installer updates">
        <RefreshCw className={busy ? "spin" : ""} />{busy ? "Checking…" : "Check updates"}
      </Button>
      {result && <span role="status">{result.available ? `v${result.latest} available` : "Up to date"}</span>}
      {result?.available && result.url && <Button asChild variant="outline" size="sm"><a href={result.url} target="_blank" rel="noreferrer"><Download />Download v{result.latest}</a></Button>}
      {error && <span role="status" className="text-muted-foreground">{error}</span>}
    </div>
  );
}