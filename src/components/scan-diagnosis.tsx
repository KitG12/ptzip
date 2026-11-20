import { AlertTriangle, CheckCircle2, Copy, Radio, Search, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ScanSummary } from "@/lib/scan-diagnostics";

export function ScanDiagnosis({
  summary,
  onScan,
  onManual,
  onCopyReport,
}: {
  summary: ScanSummary;
  onScan: () => void;
  onManual: () => void;
  onCopyReport: () => void;
}) {
  return (
    <section className="scan-diagnosis" aria-labelledby="scan-diagnosis-title">
      <div className="diagnosis-heading">
        <span className="diagnosis-symbol">
          <Search />
        </span>
        <div>
          <p className="pane-label">Scan complete · 0 cameras</p>
          <h3 id="scan-diagnosis-title">No cameras discovered</h3>
          <p>The search finished. Here is what ptzIP checked and what to try next.</p>
        </div>
      </div>

      <div className="diagnosis-section">
        <h4>Connections searched</h4>
        {summary.networks.length ? (
          <ul className="diagnosis-networks">
            {summary.networks.map((network) => (
              <li key={`${network.name}-${network.target}`}>
                <CheckCircle2 />
                <span>{network.name}</span>
                <code>{network.target}</code>
                {network.limited && <small>Local /24 only</small>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="diagnosis-muted">
            The entered IP or range, with no automatic network list.
          </p>
        )}
      </div>

      <div className="diagnosis-section">
        <h4>Search results</h4>
        <div className="diagnosis-methods">
          {summary.methods.map((method) => (
            <div key={method.id}>
              {method.attention ? <AlertTriangle /> : <CheckCircle2 />}
              <span>
                <strong>{method.name}</strong>
                <small>{method.detail}</small>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="diagnosis-advice">
        {summary.advice.map((advice) => (
          <div key={advice.kind}>
            <AlertTriangle />
            <p>
              <strong>{advice.title}</strong>
              <span>{advice.detail}</span>
            </p>
          </div>
        ))}
      </div>

      <div className="diagnosis-actions">
        <Button onClick={onScan}>
          <Radio />
          Scan again
        </Button>
        <Button variant="outline" onClick={onManual}>
          <Search />
          Query a known IP
        </Button>
        <Button variant="ghost" onClick={onCopyReport}>
          <Copy />
          Copy scan report
        </Button>
      </div>
      <p className="diagnosis-safety">
        <ShieldCheck /> Read-only search · no camera settings were changed
      </p>
    </section>
  );
}
