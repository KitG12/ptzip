import { Copy, Download, EthernetPort, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
export function CompanionSetup({
  origin,
  token,
  setToken,
  pair,
  busy,
  error,
}: {
  origin: string;
  token: string;
  setToken: (v: string) => void;
  pair: () => void;
  busy: boolean;
  error: string;
}) {
  const command = `node ptzip-helper.cjs ${origin}`;
  return (
    <section className="inline-setup">
      <div className="setup-title">
        <EthernetPort />
        <div>
          <h3>Connect your local switch</h3>
          <p>Run the companion on this computer, connected to the cameras’ network.</p>
        </div>
        <span className="device-status mismatch">
          <i />
          Not connected
        </span>
      </div>
      <ol className="helper-steps">
        <li>
          <span>1</span>
          <div>
            <strong>Download the runner</strong>
            <p>Node.js 20+ required. Open a terminal in your Downloads folder.</p>
            <Button variant="outline" size="sm" asChild>
              <a href="/downloads/ptzip-helper.cjs" download>
                <Download />
                Download helper
              </a>
            </Button>
          </div>
        </li>
        <li>
          <span>2</span>
          <div>
            <strong>Run this command</strong>
            <div className="runner-command">
              <code>{command}</code>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Copy runner command"
                title="Copy runner command"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(command);
                    toast.success("Runner command copied");
                  } catch {
                    toast.error("Select the command to copy it.");
                  }
                }}
              >
                <Copy />
              </Button>
            </div>
          </div>
        </li>
        <li>
          <span>3</span>
          <div>
            <strong>Pair the companion</strong>
            <p>Paste the token printed in your terminal and allow browser local-network access.</p>
            <div className="pair-row">
              <input
                aria-label="Companion pairing token"
                type="password"
                maxLength={100}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Pairing token"
                autoComplete="off"
              />
              <Button size="sm" disabled={!token || busy} onClick={pair}>
                {busy ? <LoaderCircle className="spin" /> : <EthernetPort />}
                {busy ? "Connecting…" : "Pair companion"}
              </Button>
            </div>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
          </div>
        </li>
      </ol>
    </section>
  );
}
