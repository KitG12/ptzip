import { EthernetPort, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ScanNetwork } from "@/lib/scan-diagnostics";

export function NetworkConnections({ networks, paired, scanning, manual, busy, error, onRefresh }: {
  networks: ScanNetwork[]; paired: boolean; scanning: boolean; manual: string;
  busy: boolean; error: string; onRefresh: () => void;
}) {
  return <section className="network-connections" aria-label="Computer connections">
    <div className="connection-heading"><EthernetPort /><strong>Computer connections</strong>
      <span>{!paired ? "Not connected" : scanning ? "Searching" : "Connected"}</span>
      <Button variant="ghost" size="icon" title="Refresh connections" aria-label="Refresh connections" disabled={!paired || busy || scanning} onClick={onRefresh}><RefreshCw className={busy ? "spin" : ""} /></Button>
    </div>
    <div className="connection-list">
      {networks.map(n => <div className="connection-entry" key={`${n.name}-${n.address ?? n.target}`}>
        <strong>{n.name}</strong><code>{n.address ?? "Address not reported"}{n.cidr ? `/${n.cidr}` : ""}</code>
        <span>{scanning ? "Searching" : "Sweep"} <code>{manual.trim() || n.target}</code>{n.limited && !manual.trim() ? " · local /24" : ""}</span>
      </div>)}
      {!networks.length && <span className="text-muted-foreground">{!paired ? "Connect the companion to read this computer’s connections." : busy ? "Reading connections…" : "No private IPv4 connections reported."}</span>}
    </div>
    {error && <p role="alert" className="text-destructive">{error}</p>}
  </section>;
}