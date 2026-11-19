import { useState } from "react";
import {
  Copy,
  ExternalLink,
  Activity,
  Info,
  Radio,
  ArrowRight,
  Video,
  Aperture,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Camera, Network, mask, validateChange } from "@/lib/cameras";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
export function CameraGlyph({ type, large = false }: { type: string; large?: boolean }) {
  return (
    <div className={large ? "camera-glyph large" : "camera-glyph"}>
      {type === "PTZ" ? <Video /> : <Aperture />}
    </div>
  );
}
function Octets({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const parts = value.split(".");
  return (
    <div className="network-field">
      <label>{label}</label>
      <div className="octets">
        {parts.map((p, i) => (
          <span key={i}>
            <input
              aria-label={`${label} octet ${i + 1}`}
              inputMode="numeric"
              maxLength={3}
              value={p}
              onChange={(e) => {
                const n = [...parts];
                n[i] = e.target.value.replace(/\D/g, "");
                onChange(n.join("."));
              }}
            />
            {i < 3 && <b>·</b>}
          </span>
        ))}
      </div>
    </div>
  );
}
export function CameraInspector({
  camera,
  cameras,
  onUpdate,
  onPing,
  onIdentify,
  onRemote,
  busy,
}: {
  camera: Camera;
  cameras: Camera[];
  onUpdate: (c: Camera) => void;
  onPing: (c: Camera) => void;
  onIdentify: (c: Camera) => void;
  onRemote: (c: Camera) => void;
  busy: boolean;
}) {
  const [form, setForm] = useState<Network>({ ...camera });
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  const keys = ["name", "ip", "cidr", "port", "securePort", "gateway", "dns1", "dns2"] as const;
  const changed = keys.some((k) => camera[k] !== form[k]);
  const field = <K extends keyof Network>(k: K, v: Network[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setError("");
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(camera.ip);
      toast.success("IP address copied");
    } catch {
      toast.error("Clipboard unavailable. Select the address to copy it.");
    }
  };
  function prepare() {
    try {
      validateChange(camera, form, cameras);
      if (camera.source === "local")
        throw Error(
          "Live network rewriting requires a tested vendor adapter. Use the camera Web UI; this companion is read-only.",
        );
      setConfirm(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check your settings.");
    }
  }
  function apply() {
    try {
      const valid = validateChange(camera, form, cameras);
      onUpdate({ ...camera, ...valid });
      setConfirm(false);
      toast.success("Demo network settings updated", {
        description: `${camera.name} → ${valid.ip}`,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not apply settings.");
      setConfirm(false);
    }
  }
  return (
    <aside className="inspector">
      <div className="pane-label">
        <span>Inspector</span>
        <span>DEVICE {String(cameras.indexOf(camera) + 1).padStart(2, "0")}</span>
      </div>
      <div className="camera-heading">
        <CameraGlyph type={camera.type} large />
        <div>
          <div className="eyebrow">{camera.brand}</div>
          <h2>{camera.model}</h2>
          <div className="camera-subtitle">
            <span
              className={`type-badge ${camera.type === "Cinema" ? "cinema" : camera.type === "PTZ" ? "ptz" : "studio"}`}
            >
              {camera.type}
            </span>
            <span
              className={`device-status ${camera.status === "Online" ? "online" : camera.status === "Offline" ? "offline" : "mismatch"}`}
            >
              <i />
              {camera.status}
            </span>
          </div>
        </div>
      </div>
      <div className="inspector-name">
        <span>CAMERA NAME</span>
        <strong>{camera.name}</strong>
      </div>
      <div className="inspector-body">
        <section className="detail-section">
          <h3>Hardware identity</h3>
          <dl>
            <dt>MAC</dt>
            <dd className="mono">{camera.mac}</dd>
            <dt>Serial</dt>
            <dd className="mono">{camera.serial}</dd>
            <dt>Firmware</dt>
            <dd>
              <span className="firmware">v{camera.firmware}</span>
            </dd>
          </dl>
        </section>
        {camera.type === "PTZ" ? (
          <section className="detail-section network-editor">
            <h3>
              Network configuration <span className="section-tag">IPv4</span>
            </h3>
            <div className="network-field">
              <label htmlFor="camera-name">Camera Name</label>
              <input
                id="camera-name"
                maxLength={60}
                value={form.name}
                onChange={(e) => field("name", e.target.value)}
              />
            </div>
            <Octets label="IP address" value={form.ip} onChange={(v) => field("ip", v)} />
            <div className="network-field">
              <label>HTTP / HTTPS Port</label>
              <div className="port-inputs">
                <input
                  aria-label="HTTP Port"
                  type="number"
                  min={1}
                  max={65535}
                  value={form.port}
                  onChange={(e) => field("port", +e.target.value)}
                />
                <span>/</span>
                <input
                  aria-label="HTTPS Port"
                  type="number"
                  min={1}
                  max={65535}
                  value={form.securePort}
                  onChange={(e) => field("securePort", +e.target.value)}
                />
              </div>
            </div>
            <div className="network-field">
              <label>Subnet Mask</label>
              <span className="mono">
                {mask(form.cidr)} <span className="text-primary">/{form.cidr}</span>
              </span>
            </div>
            <input
              aria-label="Subnet CIDR"
              className="cidr-slider"
              type="range"
              min={1}
              max={30}
              value={form.cidr}
              onChange={(e) => field("cidr", +e.target.value)}
            />
            <Octets
              label="Default Gateway"
              value={form.gateway}
              onChange={(v) => field("gateway", v)}
            />
            <Octets label="Primary DNS" value={form.dns1} onChange={(v) => field("dns1", v)} />
            <Octets label="Secondary DNS" value={form.dns2} onChange={(v) => field("dns2", v)} />
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <Button className="w-full mt-3" disabled={!changed} onClick={prepare}>
              Reconfigure Network
              <ArrowRight />
            </Button>
          </section>
        ) : (
          <section className="detail-section">
            <h3>
              Discovered network <span className="section-tag">IPv4</span>
            </h3>
            <dl>
              <dt>IP</dt>
              <dd className="ip-value">
                {camera.ip}
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Copy IP address"
                  title="Copy IP address"
                  onClick={copy}
                >
                  <Copy />
                </Button>
              </dd>
              <dt>Protocol</dt>
              <dd className="protocol-value">{camera.protocol}</dd>
              <dt>Web UI port</dt>
              <dd className="mono">
                {camera.port}/{camera.securePort}
              </dd>
            </dl>
          </section>
        )}
        <section className="detail-section">
          <h3>
            Live connection <span className="connection-dot" />
          </h3>
          <dl>
            <dt>Ping</dt>
            <dd className="latency-value">
              {camera.status === "Offline" ? "Unreachable" : `${camera.latency.toFixed(1)} ms`}
              <span className="latency-bars">
                <i />
                <i />
                <i />
                <i />
                <i />
              </span>
            </dd>
            <dt>Web Remote</dt>
            <dd>
              <span
                className={`device-status ${camera.status === "Online" ? "online" : "offline"}`}
              >
                <i />
                {camera.status === "Online" ? "Ready" : "Unavailable"}
              </span>
            </dd>
          </dl>
        </section>
        {camera.type === "Cinema" && (
          <div className="notice">
            <Info />
            <p>
              Cinema camera network addresses must be set in camera body menus or assigned via DHCP.
            </p>
          </div>
        )}
        {camera.status === "Subnet Mismatch" && (
          <div className="notice">
            <Info />
            <p>
              This camera is on a different subnet. Select its interface or update its PTZ network
              settings.
            </p>
          </div>
        )}
      </div>
      <div className="inspector-actions">
        <div className="secondary-actions">
          <Button variant="outline" size="sm" onClick={copy}>
            <Copy />
            Copy IP
          </Button>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => onPing(camera)}>
            <Activity />
            {busy
              ? "Checking…"
              : camera.type === "Cinema"
                ? "Send Test Ping"
                : "Ping / Check Latency"}
          </Button>
          {camera.type === "PTZ" && (
            <Button
              variant="outline"
              size="icon"
              title="Identify / Blink Tally"
              aria-label="Identify / Blink Tally"
              onClick={() => onIdentify(camera)}
            >
              <Radio />
            </Button>
          )}
        </div>
        <Button className="remote-button" onClick={() => onRemote(camera)}>
          <ExternalLink />
          Open in Browser
          <ArrowRight />
        </Button>
        <div className="source-note">
          <i />
          {camera.source === "demo"
            ? "SIMULATED DEVICE · DEMO MODE"
            : "LIVE DEVICE · LOCAL COMPANION"}
        </div>
      </div>
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogTitle>Confirm network reconfiguration</DialogTitle>
          <DialogDescription>
            Review changes for {camera.brand} {camera.model}. This updates the demo device only.
          </DialogDescription>
          <div className="change-table">
            <div>
              <span>SETTING</span>
              <span>BEFORE</span>
              <span>AFTER</span>
            </div>
            {keys
              .filter((k) => camera[k] !== form[k])
              .map((k) => (
                <div key={k}>
                  <span>{k}</span>
                  <span>{camera[k]}</span>
                  <strong>{form[k]}</strong>
                </div>
              ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirm(false)}>
              Cancel
            </Button>
            <Button onClick={apply}>Apply Changes</Button>
          </div>
        </DialogContent>
      </Dialog>
    </aside>
  );
}
