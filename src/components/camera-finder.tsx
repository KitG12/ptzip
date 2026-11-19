import { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  CircleHelp,
  Copy,
  Download,
  EthernetPort,
  ExternalLink,
  LoaderCircle,
  Network,
  Plus,
  Printer,
  Radio,
  Search,
  Settings2,
  ShieldCheck,
  Video,
  X,
} from "lucide-react";
import { toast, Toaster } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { CameraInspector, CameraGlyph } from "@/components/camera-inspector";
import { DesktopDownload } from "@/components/desktop-download";
import { desktopBridge } from "@/lib/desktop";
import { Camera, csv, demoCameras, download, ipv4 } from "@/lib/cameras";
import { initialDiscoveryMode, parseTarget } from "@/lib/discovery";
import { CompanionSetup } from "@/components/companion-setup";
type Log = { time: string; message: string; kind?: string | undefined };
const tabs = ["All", "PTZ", "Cinema", "Studio/Other"];
const manualSchema = z
  .object({
    host: z
      .string()
      .trim()
      .min(1)
      .max(253)
      .refine(
        (v) => ipv4.safeParse(v).success || /^[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?$/.test(v),
        "Enter a valid address or hostname.",
      ),
    port: z.number().int().min(1).max(65535),
    end: z.number().int().min(1).max(65535),
  })
  .refine(
    (v) => v.end >= v.port && v.end - v.port < 16,
    "Choose an ascending range of up to 16 ports.",
  );
const localSchema = z.object({
  id: z.string().max(100),
  type: z.enum(["PTZ", "Cinema", "Studio/Other"]),
  brand: z.string().max(60),
  model: z.string().max(100),
  name: z.string().max(60),
  ip: ipv4,
  port: z.number().int().min(1).max(65535),
  securePort: z.number().int().min(1).max(65535),
  mac: z.string().max(60),
  serial: z.string().max(100),
  firmware: z.string().max(60),
  protocol: z.string().max(100),
  latency: z.number().min(0),
  status: z.enum(["Online", "Offline", "Subnet Mismatch"]),
  source: z.literal("local"),
  cidr: z.number().int().min(1).max(30),
  gateway: ipv4,
  dns1: ipv4,
  dns2: ipv4,
});
export default function CameraFinder() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [selected, setSelected] = useState("");
  const [tab, setTab] = useState("All");
  const [brand, setBrand] = useState("All brands");
  const [search, setSearch] = useState("");
  const [subnet, setSubnet] = useState("");
  const [scanScope, setScanScope] = useState("");
  const [pendingScan, setPendingScan] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [discovered, setDiscovered] = useState(0);
  const [mode, setMode] = useState<"demo" | "local">(initialDiscoveryMode);
  const [modal, setModal] = useState<"manual" | "helper" | "export" | "remote" | null>(null);
  const [remote, setRemote] = useState<Camera | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const [hasScanned, setHasScanned] = useState(false);
  const [targetError, setTargetError] = useState("");
  const [pingBusy, setPingBusy] = useState(false);
  const [mobileInspector, setMobileInspector] = useState(false);
  const [host, setHost] = useState("");
  const [port, setPort] = useState(80);
  const [endPort, setEndPort] = useState(80);
  const [manualError, setManualError] = useState("");
  const [manualBusy, setManualBusy] = useState(false);
  const [token, setToken] = useState("");
  const [paired, setPaired] = useState(false);
  const [pairBusy, setPairBusy] = useState(false);
  const [helperError, setHelperError] = useState("");
  const [origin, setOrigin] = useState("");
  const [report, setReport] = useState("");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const epoch = useRef(0);
  useEffect(() => {
    setOrigin(window.location.origin);
    const bridge = desktopBridge();
    if (bridge?.token) setToken(bridge.token);
    return () => {
      if (timer.current) clearInterval(timer.current);
      epoch.current++;
    };
  }, []);
  function log(message: string, kind?: string) {
    setLogs((l) =>
      [
        { time: new Date().toLocaleTimeString("en-GB", { hour12: false }), message, kind },
        ...l,
      ].slice(0, 30),
    );
  }
  async function companion(path: string, data: object = {}) {
    let r: Response;
    try {
      r = await fetch(`http://127.0.0.1:3344${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Camera-Token": token },
        body: JSON.stringify(data),
        signal: AbortSignal.timeout(path === "/scan" ? 600000 : 10000),
      });
    } catch {
      setPaired(false);
      throw Error(
        "Companion unavailable. Start the runner on this computer, check the app origin, and allow local-network access in your browser.",
      );
    }
    if (!r.ok) throw Error("Companion rejected this app. Check the exact app origin.");
    const result = await r.json();
    if (result.error) {
      if (result.error === "Invalid companion token.") setPaired(false);
      throw Error(result.error);
    }
    return result;
  }
  const filtered = cameras.filter(
    (c) =>
      (tab === "All" || c.type === tab) &&
      (brand === "All brands" || c.brand === brand) &&
      `${c.brand} ${c.model} ${c.name} ${c.ip} ${c.mac}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const camera = filtered.find((c) => c.id === selected) ?? filtered[0];
  function cancelScan() {
    epoch.current++;
    if (timer.current) clearInterval(timer.current);
    setScanning(false);
  }
  function changeMode(next: "local" | "demo") {
    cancelScan();
    setMode(next);
    setCameras(next === "demo" ? demoCameras : []);
    setSelected(next === "demo" ? "demo-0" : "");
    setTab("All");
    setBrand("All brands");
    setSearch("");
    setLogs([]);
    setHasScanned(false);
    setProgress(0);
    setDiscovered(0);
    setMobileInspector(false);
    setTargetError("");
    setManualError("");
    setPendingScan(false);
    setScanScope("");
  }
  async function scan(connected = paired) {
    if (scanning || manualBusy) return;
    setTargetError("");
    let targets: string[];
    try {
      targets = subnet.trim()
        ? parseTarget(subnet)
        : mode === "demo"
          ? parseTarget("192.168.1.0/24")
          : [];
    } catch (e) {
      setTargetError(e instanceof Error ? e.message : "Check the scan target.");
      return;
    }
    if (mode === "local" && !connected) {
      setPendingScan(true);
      setHelperError(
        "Your browser cannot access the switch directly. Start and pair the local companion; this scan will begin automatically after pairing.",
      );
      setModal("helper");
      return;
    }
    setPendingScan(false);
    setModal(null);
    setHasScanned(true);
    const current = ++epoch.current;
    setScanning(true);
    setProgress(0);
    setDiscovered(0);
    const label = subnet.trim() || (mode === "demo" ? "192.168.1.0/24" : "all connected networks");
    setScanScope(label);
    log(`Scanning ${label} · ${mode === "demo" ? "simulation" : "local companion"}`);
    if (mode === "demo") {
      const found = demoCameras.filter((c) => targets.includes(c.ip));
      setCameras([]);
      let p = 0;
      timer.current = setInterval(() => {
        p += 5;
        setProgress(p);
        const count = Math.floor((found.length * p) / 100);
        setDiscovered(count);
        setCameras(found.slice(0, count));
        if (p >= 100) {
          if (timer.current) clearInterval(timer.current);
          setScanning(false);
          setSelected(found[0]?.id ?? "");
          log(`Discovery complete. ${found.length} cameras found on ${label}.`, "success");
          toast.success(`Scan complete · ${found.length} cameras discovered`);
        }
      }, 170);
    } else {
      timer.current = setInterval(() => setProgress((p) => Math.min(94, p + 1)), 650);
      try {
        const r = await companion("/scan", subnet.trim() ? { target: subnet } : { auto: true });
        if (current !== epoch.current) return;
        const rows = z.array(localSchema).max(8192).parse(r.devices);
        setCameras(rows);
        setDiscovered(rows.length);
        setSelected(rows[0]?.id ?? "");
        setTab("All");
        setBrand("All brands");
        setSearch("");
        setProgress(100);
        if (Array.isArray(r.networks)) {
          const scopes = z
            .array(
              z.object({
                name: z.string().max(100),
                target: z.string().max(80),
                limited: z.boolean(),
              }),
            )
            .max(32)
            .parse(r.networks);
          if (scopes.length) setScanScope(scopes.map((n) => `${n.name}: ${n.target}`).join(" · "));
          if (scopes.some((n) => n.limited))
            log(
              "Large networks: swept the local /24 on each interface plus ONVIF announcements. Enter a range to check other addresses.",
            );
        }
        const diag = z
          .record(
            z.string().max(20),
            z.object({
              adapters: z.number(),
              sent: z.number(),
              pinned: z.number().optional(),
              replies: z.number(),
              parsed: z.number(),
              errors: z.array(z.string().max(300)).max(12),
              sample: z.string().max(1000),
            }),
          )
          .safeParse(r.diagnostics ?? {});
        const names: Record<string, string> = { panasonic: "Panasonic search", sony: "Sony search" };
        if (diag.success) {
          const lines = Object.entries(diag.data).map(
            ([k, d]) =>
              `${names[k] ?? k}: ${d.adapters} adapters, ${d.sent} requests sent (${d.pinned ?? 0} pinned to an adapter), ${d.replies} replies, ${d.parsed} cameras recognised${d.errors.length ? ` · problems: ${d.errors.join("; ")}` : ""}${d.sample ? ` · unrecognised reply ${d.sample}` : ""}`,
          );
          setReport(
            [`ptzIP scan report ${new Date().toISOString()}`, `Networks: ${label}`, ...lines, `Devices: ${rows.map((c) => `${c.brand} ${c.model} ${c.ip} ${c.status}`).join(", ") || "none"}`].join("\n"),
          );
          for (const [k, d] of Object.entries(diag.data)) {
            if (d.errors.length) log(`${names[k] ?? k} problem: ${d.errors[0]}`, "error");
            else if (d.replies && !d.parsed)
              log(`${names[k] ?? k} got ${d.replies} replies it could not read. Copy the report and send it to support.`, "error");
          }
        }
        log(`Local scan complete. ${rows.length} identified cameras.`, "success");
        toast.success(`${rows.length} cameras discovered`);
      } catch (e) {
        if (current !== epoch.current) return;
        const message = e instanceof Error ? e.message : "Companion unavailable.";
        setTargetError(message);
        toast.error(message);
        log("Scan failed. Check the local companion and network.", "error");
      } finally {
        if (current === epoch.current) {
          if (timer.current) clearInterval(timer.current);
          setScanning(false);
        }
      }
    }
  }
  async function ping(c: Camera) {
    setPingBusy(true);
    try {
      if (c.source === "demo") {
        await new Promise((r) => setTimeout(r, 750));
        if (c.status === "Offline") {
          toast.error(`${c.name} is unreachable (simulation)`);
          log(`${c.ip} · connection timed out (simulation).`, "error");
        } else {
          const latency = +(c.latency + 0.2).toFixed(1);
          setCameras((cs) => cs.map((x) => (x.id === c.id ? { ...x, latency } : x)));
          toast.success(`${c.ip} · ${latency} ms (simulated ping)`);
          log(`${c.ip} responded in ${latency} ms (simulation).`, "success");
        }
      } else {
        const r = await companion("/ping", { ip: c.ip, port: c.port });
        setCameras((cs) =>
          cs.map((x) =>
            x.id === c.id ? { ...x, latency: r.latency, status: r.open ? "Online" : "Offline" } : x,
          ),
        );
        if (r.open) toast.success(`${c.ip} · TCP connected in ${r.latency} ms`);
        else toast.error("Connection timed out.");
        log(
          `${c.ip} · TCP connection ${r.open ? "successful" : "failed"}.`,
          r.open ? "success" : "error",
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Connection check failed.");
    } finally {
      setPingBusy(false);
    }
  }
  async function addManual() {
    setManualError("");
    const v = manualSchema.safeParse({ host, port, end: endPort });
    if (!v.success) {
      setManualError(v.error.issues[0]?.message ?? "Check your address and port range.");
      return;
    }
    const current = epoch.current;
    setManualBusy(true);
    try {
      if (mode === "demo") {
        await new Promise((r) => setTimeout(r, 650));
        if (current !== epoch.current) return;
        const match = demoCameras.find(
          (c) => c.ip === host || `${c.name}.local`.toLowerCase() === host.toLowerCase(),
        );
        if (!match || match.port < port || match.port > endPort)
          throw Error(
            "No demo camera found. Try 192.168.1.85 on port 80. For real cameras, connect the local companion.",
          );
        setCameras((cs) => (cs.some((c) => c.ip === match.ip) ? cs : [...cs, match]));
        setSelected(match.id);
        toast.success("Camera found · selected in list");
      } else {
        if (!paired)
          throw Error(
            "Pair the companion on the main screen first; your browser cannot query local cameras by itself.",
          );
        if (!ipv4.safeParse(host).success)
          throw Error(
            "This companion requires a numeric private IPv4 address. Resolve the hostname on your workstation first.",
          );
        let found: Camera[] = [];
        let problem = "";
        for (let p = port; p <= endPort; p++) {
          const r = await companion("/add", { ip: host, port: p });
          if (current !== epoch.current) return;
          found = z.array(localSchema).parse(r.devices);
          const errs = z
            .record(z.string().max(20), z.object({ errors: z.array(z.string().max(300)).max(12) }))
            .safeParse(r.diagnostics ?? {});
          if (errs.success)
            problem = Object.values(errs.data).flatMap((d) => d.errors)[0] ?? problem;
          if (found.length) break;
        }
        if (!found.length)
          throw Error(
            `No response from ${host}. Check the camera is powered and plugged into the same switch as this computer.${problem ? ` Search problem: ${problem}.` : " Quit EasyIP while ptzIP searches."}`,
          );
        setCameras((cs) => [...cs.filter((c) => !found.some((f) => f.ip === c.ip)), ...found]);
        setSelected(found[0]?.id ?? "");
        log(`Manually discovered ${host}.`, "success");
      }
      setHasScanned(true);
      setTab("All");
      setBrand("All brands");
      setSearch("");
      setModal(null);
    } catch (e) {
      setManualError(e instanceof Error ? e.message : "Could not add camera.");
    } finally {
      setManualBusy(false);
    }
  }
  async function pair() {
    setPairBusy(true);
    setHelperError("");
    try {
      await companion("/health");
      setPaired(true);
      setMode("local");
      setCameras([]);
      setModal(null);
      log("Local companion connected. Ready for real discovery.", "success");
      toast.success("Local companion connected");
      if (pendingScan) await scan(true);
    } catch (e) {
      setHelperError(
        e instanceof Error
          ? e.message
          : "Could not connect. Start the companion, check the origin and token, and allow local-network access.",
      );
    } finally {
      setPairBusy(false);
    }
  }
  const autoPaired = useRef(false);
  useEffect(() => {
    const bridge = desktopBridge();
    if (bridge?.token && token === bridge.token && !autoPaired.current) {
      autoPaired.current = true;
      void pair();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
  function exportCSV() {
    download(
      new Blob([csv(filtered)], { type: "text/csv;charset=utf-8" }),
      "ptzIP-camera-patch-sheet.csv",
    );
    log(`Exported ${filtered.length} cameras to CSV.`, "success");
    toast.success("Camera patch sheet exported");
    setModal(null);
  }
  const openRemote = (c: Camera) => {
    setRemote(c);
    setModal("remote");
  };
  const scopeLabel = subnet || scanScope || (mode === "demo" ? "192.168.1.0/24" : "All connected networks");
  return (
    <div className={`app-shell ${mode === "local" && !paired ? "setup-open" : ""}`}>
      <Toaster theme="dark" position="bottom-right" />
      <header className="app-header">
        <div className="app-brand">
          <span className="brand-symbol">
            <Video />
          </span>
          <h1>ptzIP</h1>
          <span className="edition">MULTI-BRAND</span>
        </div>
        <div className="header-tools">
          <span className={`mode-indicator ${mode === "local" && paired ? "connected" : ""}`}>
            <i />
            {mode === "demo"
              ? "Demo Sandbox"
              : paired
                ? "Local companion connected"
                : "Ready to scan · pair companion"}
          </span>
          <DesktopDownload />
          <Button
            variant="ghost"
            size="icon"
            title="Local discovery companion"
            aria-label="Local discovery companion"
            onClick={() => setModal("helper")}
          >
            <EthernetPort />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="About network discovery"
            aria-label="About network discovery"
            onClick={() => setModal("helper")}
          >
            <CircleHelp />
          </Button>
        </div>
      </header>
      <div className="control-bar">
        <div className="category-tabs" role="tablist" aria-label="Camera category">
          {tabs.map((t) => (
            <Button
              key={t}
              role="tab"
              aria-selected={t === tab}
              variant="ghost"
              size="sm"
              className={t === tab ? "active" : ""}
              onClick={() => {
                setTab(t);
                setMobileInspector(false);
              }}
            >
              {t}
              {t === "All" && <span>{cameras.length}</span>}
            </Button>
          ))}
        </div>
        <div className="scan-controls">
          <div className="subnet-select">
            <Network />
            <input
              aria-label="IP / Subnet sweep"
              value={subnet}
              disabled={scanning}
              maxLength={80}
              placeholder="Auto · all connected networks"
              onChange={(e) => {
                setSubnet(e.target.value);
                setTargetError("");
              }}
            />
          </div>
          <Button
            className="scan-button"
            disabled={pairBusy || manualBusy}
            onClick={() => (scanning ? cancelScan() : scan())}
          >
            {scanning ? <X /> : <Radio />}
            {scanning ? "Stop Scan" : "Scan Network"}
          </Button>
        </div>
      </div>
      {targetError && (
        <p className="target-error form-error" role="alert">
          {targetError}
        </p>
      )}
      {scanning && (
        <div className="scan-progress">
          <progress value={progress} max={100} />
          <span>
            <LoaderCircle className="spin" />
            Scanning {scanScope} · {discovered} cameras discovered <b>{progress}%</b>
          </span>
        </div>
      )}
      <main className={`workspace ${mobileInspector ? "show-inspector" : ""}`}>
        <section className="camera-pane">
          <div className="pane-title">
            <div>
              <h2>
                Cameras <span>{filtered.length}</span>
              </h2>
              <p>
                {mode === "demo" ? "Demo Sandbox · sample data" : "Live Discovery"} <span> / </span>{" "}
                {scopeLabel}
              </p>
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                title="Export / Patch sheet"
                aria-label="Export / Patch sheet"
                onClick={() => setModal("export")}
                disabled={!filtered.length}
              >
                <ArrowDownToLine />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={scanning || manualBusy}
                onClick={() => {
                  setManualError("");
                  setModal("manual");
                }}
              >
                <Plus />
                Add Camera
              </Button>
            </div>
          </div>
          <div className="filter-bar">
            <div className="search-field">
              <Search />
              <input
                aria-label="Search cameras"
                placeholder="Search model, name, IP or MAC…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Clear search"
                  onClick={() => setSearch("")}
                >
                  <X />
                </Button>
              )}
            </div>
            <div className="brand-select">
              <Settings2 />
              <select
                aria-label="Camera brand"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
              >
                <option>All brands</option>
                {[...new Set(demoCameras.map((c) => c.brand).concat(cameras.map((c) => c.brand)))]
                  .sort()
                  .map((b) => (
                    <option key={b}>{b}</option>
                  ))}
              </select>
              <ChevronDown />
            </div>
          </div>
          {mode === "local" && (
            <form
              className="direct-query"
              onSubmit={(e) => {
                e.preventDefault();
                addManual();
              }}
            >
              <div>
                <label htmlFor="direct-ip">Manual IP</label>
                <input
                  id="direct-ip"
                  aria-label="Manual camera IP"
                  placeholder="192.168.1.147"
                  value={host}
                  maxLength={253}
                  onChange={(e) => {
                    setHost(e.target.value);
                    setManualError("");
                  }}
                />
              </div>
              <div className="query-port">
                <label htmlFor="direct-port">Port</label>
                <input
                  id="direct-port"
                  type="number"
                  min={1}
                  max={65535}
                  value={port}
                  onChange={(e) => {
                    setPort(Number(e.target.value));
                    setEndPort(Number(e.target.value));
                  }}
                />
              </div>
              <Button type="submit" variant="outline" size="sm" disabled={manualBusy || scanning}>
                {manualBusy ? <LoaderCircle className="spin" /> : <Search />}
                {manualBusy ? "Checking…" : "Query IP"}
              </Button>
              {manualError && modal !== "manual" && (
                <p className="form-error" role="alert">
                  {manualError}
                </p>
              )}
            </form>
          )}
          <div className="table-scroll">
            {mode === "local" && !paired && (
              <CompanionSetup
                origin={origin}
                token={token}
                setToken={setToken}
                pair={pair}
                busy={pairBusy}
                error={helperError}
              />
            )}

            {(mode === "demo" || paired || cameras.length > 0) && (
              <table className="camera-table">
                <thead>
                  <tr>
                    <th aria-label="Status" />
                    <th>Type</th>
                    <th>Brand / Model</th>
                    <th>Camera Name</th>
                    <th>IP</th>
                    <th>MAC</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr
                      key={c.id}
                      tabIndex={0}
                      aria-selected={camera?.id === c.id}
                      onClick={() => {
                        setSelected(c.id);
                        setMobileInspector(true);
                      }}
                      onDoubleClick={() =>
                        window.open(`http://${c.ip}:${c.port}/`, "_blank", "noopener,noreferrer")
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelected(c.id);
                          setMobileInspector(true);
                        }
                      }}
                      className={camera?.id === c.id ? "selected" : ""}
                    >
                      <td>
                        <span
                          title={c.status}
                          aria-label={c.status}
                          className={`status-dot ${c.status === "Online" ? "online" : c.status === "Offline" ? "offline" : "mismatch"}`}
                        />
                      </td>
                      <td>
                        <span
                          className={`type-badge ${c.type === "Cinema" ? "cinema" : c.type === "PTZ" ? "ptz" : "studio"}`}
                        >
                          {c.type === "Studio/Other" ? "Studio" : c.type}
                        </span>
                      </td>
                      <td>
                        <strong>{c.brand}</strong>
                        <span className="model-cell">{c.model}</span>
                      </td>
                      <td className="camera-name-cell">{c.name}</td>
                      <td className="mono ip-cell">
                        {c.ip}
                        {c.status === "Subnet Mismatch" && (
                          <span className="mismatch-label">Subnet Mismatch</span>
                        )}
                      </td>
                      <td className="mono mac-cell">{c.mac}</td>
                      <td className="row-actions">
                        <Button
                          variant="ghost"
                          size="icon"
                          title={`Open ${c.ip} in browser`}
                          aria-label={`Open ${c.name} in browser`}
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(`http://${c.ip}:${c.port}/`, "_blank", "noopener,noreferrer");
                            log(`Opened ${c.ip} in browser.`);
                          }}
                        >
                          <ExternalLink />
                        </Button>
                        <ChevronDown className="row-chevron" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {!filtered.length && (paired || mode === "demo") && (
              <div className="empty-state">
                {scanning ? <Radio className="pulse" /> : <Search />}
                <h3>
                  {scanning
                    ? "Listening for cameras…"
                    : cameras.length
                      ? "No matching cameras"
                      : hasScanned
                        ? "No cameras discovered"
                        : "Ready to scan"}
                </h3>
                <p>
                  {scanning
                    ? "Checking discovery protocols on the selected subnet."
                    : cameras.length
                      ? "Try another brand, category or search."
                      : mode === "demo"
                        ? "Choose 192.168.1.0/24 to scan the sample production network."
                        : hasScanned
                          ? "No camera was identified. Check power, routing and the web service port, or query a specific IP."
                          : "Companion connected. Scan Network automatically detects connected networks. Enter an IP or range above to narrow the scan."}
                </p>
                {!scanning && (
                  <Button
                    variant="outline"
                    disabled={pairBusy || manualBusy}
                    onClick={() => {
                      if (cameras.length) {
                        setTab("All");
                        setBrand("All brands");
                        setSearch("");
                      } else scan();
                    }}
                  >
                    {cameras.length ? "Clear filters" : "Scan Network"}
                  </Button>
                )}
              </div>
            )}
          </div>
          <div className="table-summary">
            <span>
              <i className="status-dot online" />
              {cameras.filter((c) => c.status === "Online").length} online
            </span>
            <span>
              <i className="status-dot offline" />
              {cameras.filter((c) => c.status === "Offline").length} offline
            </span>
            <span>
              <i className="status-dot mismatch" />
              {cameras.filter((c) => c.status === "Subnet Mismatch").length} subnet mismatch
            </span>
          </div>
          <div className="activity-panel">
            <div className="activity-title">
              <h3>
                <Activity />
                Network activity
              </h3>
              {report && !scanning ? (
                <button
                  type="button"
                  className="report-copy"
                  onClick={() =>
                    navigator.clipboard
                      .writeText(report)
                      .then(() => toast.success("Scan report copied"))
                      .catch(() => toast.error("Could not copy the report"))
                  }
                >
                  Copy scan report
                </button>
              ) : (
                <span>{scanning ? "LISTENING" : "SESSION LOG"}</span>
              )}
            </div>
            <div className="activity-logs">
              {!logs.length && (
                <span>
                  {mode === "local"
                    ? "Ready to scan · no network queries sent yet."
                    : "Demo Sandbox · simulated devices only."}
                </span>
              )}
              {logs.slice(0, 3).map((l, i) => (
                <div key={`${l.time}-${i}`}>
                  <time>{l.time}</time>
                  <span
                    className={
                      l.kind === "success"
                        ? "text-success"
                        : l.kind === "error"
                          ? "text-destructive"
                          : ""
                    }
                  >
                    {l.kind === "success" && <Check />}
                    {l.message}
                  </span>
                </div>
              ))}
            </div>
            <div className="protocol-strip">
              <span>{mode === "local" ? "COMPANION PROTOCOLS" : "SIMULATED PROTOCOLS"}</span>
              {mode === "local" ? (
                <>
                  <b>Panasonic EasyIP</b>
                  <b>Sony VISCA</b>
                  <b>Bonjour</b>
                  <b>ONVIF</b>
                  <b>HTTP identification</b>
                  <b>TCP checks</b>
                </>
              ) : (
                <>
                  <b>mDNS</b>
                  <b>Easy IP</b>
                  <b>VISCA</b>
                  <b>CAP / RCP2</b>
                </>
              )}
            </div>
          </div>
        </section>
        <div className="inspector-wrap">
          <Button className="back-button" variant="ghost" onClick={() => setMobileInspector(false)}>
            <ArrowLeft />
            Cameras
          </Button>
          {camera ? (
            <CameraInspector
              key={camera.id}
              camera={camera}
              cameras={cameras}
              onUpdate={(c) => {
                setCameras((cs) => cs.map((x) => (x.id === c.id ? c : x)));
                log(`${c.name} network updated to ${c.ip} (simulation).`, "success");
              }}
              onPing={ping}
              onRemote={openRemote}
              onIdentify={(c) => {
                if (c.source === "demo") {
                  toast.success(`${c.name} · tally blinking (simulation)`);
                  log(`Identify signal sent to ${c.name} (simulation).`);
                } else {
                  toast.info(
                    "Use the camera Web UI to identify this device. The local companion does not transmit tally commands.",
                  );
                  openRemote(c);
                }
              }}
              busy={pingBusy}
            />
          ) : (
            <aside className="inspector empty-inspector">
              <div className="pane-label">Inspector</div>
              <div className="empty-state">
                <CameraGlyph type="Cinema" large />
                <h3>{mode === "local" && !hasScanned ? "Ready to scan" : "Select a camera"}</h3>
                <p>
                  {mode === "local" && !paired
                    ? "Pair your local companion, then scan your switch or query a camera IP. No sample cameras are loaded in Live Discovery."
                    : "Camera identity and connection details appear here."}
                </p>
              </div>
            </aside>
          )}
        </div>
      </main>
      <footer className="status-bar">
        <span>
          <ShieldCheck />
          {mode === "demo"
            ? "Demo mode · no physical devices modified"
            : "Read-only local discovery"}
        </span>
        <span>
          <EthernetPort />
          {scopeLabel}
          <i />
          {cameras.length} devices <span className="footer-version">v1.0</span>
        </span>
      </footer>
      <Dialog
        open={modal !== null}
        onOpenChange={(o) => {
          if (!o) {
            setModal(null);
            setPendingScan(false);
          }
        }}
      >
        <DialogContent className="utility-modal">
          {modal === "manual" && (
            <>
              <DialogTitle>Add Camera</DialogTitle>
              <DialogDescription>
                Find a camera by address on another VLAN or routed network.
              </DialogDescription>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  addManual();
                }}
                className="modal-form"
              >
                <label>
                  IP address / hostname
                  <input
                    autoFocus
                    maxLength={253}
                    placeholder="192.168.1.85 or a-cam.local"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                  />
                </label>
                <div className="form-columns">
                  <label>
                    Start port
                    <input
                      type="number"
                      min={1}
                      max={65535}
                      value={port}
                      onChange={(e) => {
                        setPort(+e.target.value);
                        setEndPort(+e.target.value);
                      }}
                    />
                  </label>
                  <label>
                    End port
                    <input
                      type="number"
                      min={1}
                      max={65535}
                      value={endPort}
                      onChange={(e) => setEndPort(+e.target.value)}
                    />
                  </label>
                </div>
                <div className="notice">
                  <Network />
                  <p>
                    {mode === "demo"
                      ? "Demo mode searches the production sample dataset. No physical network traffic is sent."
                      : "The read-only companion probes up to 16 ports at this private IPv4 address."}
                  </p>
                </div>
                {manualError && (
                  <p role="alert" className="form-error">
                    {manualError}
                  </p>
                )}
                <Button type="submit" disabled={manualBusy || scanning}>
                  {manualBusy ? <LoaderCircle className="spin" /> : <Search />}
                  {manualBusy ? "Checking address…" : "Find Camera"}
                </Button>
              </form>
            </>
          )}
          {modal === "helper" && (
            <>
              <DialogTitle>Local discovery companion</DialogTitle>
              <DialogDescription>
                {pendingScan
                  ? "Scan requested — pair the companion to start scanning connected networks automatically."
                  : "Connect this workspace to cameras on your workstation’s network."}
              </DialogDescription>
              <CompanionSetup
                origin={origin}
                token={token}
                setToken={setToken}
                pair={pair}
                busy={pairBusy}
                error={helperError}
              />
              <div className="protocol-grid">
                <span>
                  Panasonic Easy IP <b>UDP 10669</b>
                </span>
                <span>
                  Sony VISCA <b>UDP 52381</b>
                </span>
                <span>
                  ONVIF WS-Discovery <b>UDP 3702</b>
                </span>
                <span>
                  mDNS / Bonjour <b>UDP 5353</b>
                </span>
              </div>
              <div className="notice">
                <CircleHelp />
                <p>
                  This helper supports ONVIF discovery, HTTP camera identification and TCP checks.
                  Easy IP, VISCA, mDNS and vendor network rewriting require tested desktop adapters.
                  Browsers cannot use raw UDP sockets. Only your app’s origin and pairing token are
                  accepted.
                </p>
              </div>
            </>
          )}
          {modal === "export" && (
            <>
              <DialogTitle>ptzIP · Export / Patch sheet</DialogTitle>
              <DialogDescription>
                {filtered.length} cameras from your current view · {scopeLabel}
              </DialogDescription>
              <div className="export-options">
                <Button variant="outline" onClick={exportCSV}>
                  <Download />
                  <span>
                    <strong>Export CSV</strong>
                    <small>Addresses, identity and connection details</small>
                  </span>
                  <ArrowRight />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setModal(null);
                    setTimeout(() => window.print(), 150);
                  }}
                >
                  <Printer />
                  <span>
                    <strong>Print / Save PDF</strong>
                    <small>Formatted camera patch sheet</small>
                  </span>
                  <ArrowRight />
                </Button>
              </div>
              <div className="notice">
                <CircleHelp />
                <p>
                  Includes only cameras matching your filters. For PDF, choose Save as PDF in the
                  print dialog.
                </p>
              </div>
            </>
          )}
          {modal === "remote" && remote && (
            <>
              <DialogTitle>
                {remote.brand} {remote.model} · Web Remote
              </DialogTitle>
              <DialogDescription>
                {remote.name} · {remote.ip}
              </DialogDescription>
              <div className="remote-address">
                <ExternalLink />
                <code>
                  http://{remote.ip}:{remote.port}/
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Copy web remote URL"
                  title="Copy URL"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(`http://${remote.ip}:${remote.port}/`);
                      toast.success("Remote URL copied");
                    } catch {
                      toast.error("Clipboard unavailable");
                    }
                  }}
                >
                  <Copy />
                </Button>
              </div>
              <div className="notice">
                <Network />
                <p>
                  {remote.source === "demo"
                    ? "This is a simulated device. The address opens a remote only if a real camera is reachable at this IP on your network."
                    : "Your browser must be on the camera network or connected through a routed VLAN / VPN. Login is handled by the camera."}
                  {remote.status === "Offline"
                    ? " The last check reported this camera offline."
                    : ""}
                </p>
              </div>
              <Button
                onClick={() => {
                  window.open(
                    `http://${remote.ip}:${remote.port}/`,
                    "_blank",
                    "noopener,noreferrer",
                  );
                  log(`Web remote launched for ${remote.ip}.`);
                }}
              >
                <ExternalLink />
                Open Camera Web Remote
                <ArrowRight />
              </Button>
              <Button variant="outline" asChild>
                <a
                  href={`https://${remote.ip}:${remote.securePort}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open HTTPS Remote
                </a>
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
      <section className="print-sheet">
        <h1>ptzIP · Camera Patch Sheet</h1>
        <p>
          {scopeLabel} · {mode === "demo" ? "SIMULATED DATA" : "Local discovery"} · {filtered.length}{" "}
          cameras
        </p>
        <table>
          <thead>
            <tr>
              {["Camera", "Type", "Brand / Model", "IP", "MAC", "Port", "Status"].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.type}</td>
                <td>
                  {c.brand} {c.model}
                </td>
                <td>{c.ip}</td>
                <td>{c.mac}</td>
                <td>{c.port}</td>
                <td>{c.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
