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
import { Camera, csv, demoCameras, download, ipv4, sameSubnet } from "@/lib/cameras";
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
  const [cameras, setCameras] = useState<Camera[]>(demoCameras);
  const [selected, setSelected] = useState("demo-0");
  const [tab, setTab] = useState("All");
  const [brand, setBrand] = useState("All brands");
  const [search, setSearch] = useState("");
  const [subnet, setSubnet] = useState("192.168.1.0/24");
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [discovered, setDiscovered] = useState(10);
  const [mode, setMode] = useState<"demo" | "local">("demo");
  const [modal, setModal] = useState<"manual" | "helper" | "export" | "remote" | null>(null);
  const [remote, setRemote] = useState<Camera | null>(null);
  const [logs, setLogs] = useState<Log[]>([
    {
      time: "09:26:03",
      message: "Discovery complete. 10 cameras found on the network.",
      kind: "success",
    },
    { time: "09:26:02", message: "ARRI Alexa 35 detected via Bonjour / mDNS / CAP." },
    { time: "09:26:01", message: "Listening for camera announcements on 192.168.1.0/24." },
  ]);
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
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const epoch = useRef(0);
  useEffect(() => {
    setOrigin(window.location.origin);
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
    const r = await fetch(`http://127.0.0.1:3344${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Camera-Token": token },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(90000),
    });
    if (!r.ok) throw Error("Companion rejected this app. Check the exact app origin.");
    const result = await r.json();
    if (result.error) throw Error(result.error);
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
  async function scan() {
    if (scanning) return;
    if (mode === "local" && !paired) {
      setModal("helper");
      return;
    }
    const current = ++epoch.current;
    setScanning(true);
    setProgress(0);
    setDiscovered(0);
    log(`Scanning ${subnet} · ${mode === "demo" ? "simulation" : "local companion"}`);
    if (mode === "demo") {
      const found = demoCameras.filter(
        (c) =>
          sameSubnet(c.ip, subnet.split("/")[0] ?? "192.168.1.0", 24) ||
          (subnet === "192.168.1.0/24" && c.status === "Subnet Mismatch"),
      );
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
          log(`Discovery complete. ${found.length} cameras found on ${subnet}.`, "success");
          toast.success(`Scan complete · ${found.length} cameras discovered`);
        }
      }, 170);
    } else {
      timer.current = setInterval(() => setProgress((p) => Math.min(94, p + 1)), 650);
      try {
        const r = await companion("/scan", { subnet });
        if (current !== epoch.current) return;
        const rows = z.array(localSchema).max(512).parse(r.devices);
        setCameras(rows);
        setDiscovered(rows.length);
        setSelected(rows[0]?.id ?? "");
        setProgress(100);
        log(`Local scan complete. ${rows.length} identified cameras.`, "success");
        toast.success(`${rows.length} cameras discovered`);
      } catch (e) {
        if (current !== epoch.current) return;
        toast.error(e instanceof Error ? e.message : "Companion unavailable.");
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
    setManualBusy(true);
    try {
      if (mode === "demo") {
        await new Promise((r) => setTimeout(r, 650));
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
        if (!paired) throw Error("Connect the local companion first.");
        if (!ipv4.safeParse(host).success)
          throw Error(
            "This companion requires a numeric private IPv4 address. Resolve the hostname on your workstation first.",
          );
        let found: Camera[] = [];
        for (let p = port; p <= endPort; p++) {
          const r = await companion("/add", { ip: host, port: p });
          found = z.array(localSchema).parse(r.devices);
          if (found.length) break;
        }
        if (!found.length)
          throw Error("No camera identified. Check routing, power, and web access.");
        setCameras((cs) => [...cs.filter((c) => !found.some((f) => f.ip === c.ip)), ...found]);
        setSelected(found[0]?.id ?? "");
        log(`Manually discovered ${host}.`, "success");
      }
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
  function exportCSV() {
    download(
      new Blob([csv(filtered)], { type: "text/csv;charset=utf-8" }),
      "camera-patch-sheet.csv",
    );
    log(`Exported ${filtered.length} cameras to CSV.`, "success");
    toast.success("Camera patch sheet exported");
    setModal(null);
  }
  const openRemote = (c: Camera) => {
    setRemote(c);
    setModal("remote");
  };
  return (
    <div className="app-shell">
      <Toaster theme="dark" position="bottom-right" />
      <header className="app-header">
        <div className="app-brand">
          <span className="brand-symbol">
            <Video />
          </span>
          <h1>Camera Finder</h1>
          <span className="edition">MULTI-BRAND</span>
        </div>
        <div className="header-tools">
          <span className={`mode-indicator ${mode === "local" && paired ? "connected" : ""}`}>
            <i />
            {mode === "demo"
              ? "Demo workspace"
              : paired
                ? "Local companion connected"
                : "Local companion offline"}
          </span>
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
            <select
              aria-label="Network interface / subnet"
              value={subnet}
              disabled={scanning}
              onChange={(e) => setSubnet(e.target.value)}
            >
              <option>192.168.1.0/24</option>
              <option>192.168.2.0/24</option>
              <option>10.0.0.0/24</option>
            </select>
            <ChevronDown />
          </div>
          <Button className="scan-button" onClick={scanning ? cancelScan : scan}>
            {scanning ? <X /> : <Radio />}
            {scanning ? "Stop Scan" : "Scan Network"}
          </Button>
        </div>
      </div>
      {scanning && (
        <div className="scan-progress">
          <progress value={progress} max={100} />
          <span>
            <LoaderCircle className="spin" />
            Scanning {subnet} · {discovered} cameras discovered <b>{progress}%</b>
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
                {mode === "demo" ? "Production network" : "Local network"} <span> / </span> {subnet}
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
          <div className="table-scroll">
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
                    <td>
                      <ChevronDown className="row-chevron" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filtered.length && (
              <div className="empty-state">
                {scanning ? <Radio className="pulse" /> : <Search />}
                <h3>
                  {scanning
                    ? "Listening for cameras…"
                    : cameras.length
                      ? "No matching cameras"
                      : "No cameras discovered"}
                </h3>
                <p>
                  {scanning
                    ? "Checking discovery protocols on the selected subnet."
                    : cameras.length
                      ? "Try another brand, category or search."
                      : mode === "demo"
                        ? "Choose 192.168.1.0/24 to scan the sample production network."
                        : "Scan your network or add a camera on a routed network."}
                </p>
                {!scanning && (
                  <Button
                    variant="outline"
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
              <span>{scanning ? "LISTENING" : "SESSION LOG"}</span>
            </div>
            <div className="activity-logs">
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
              <span>DISCOVERY PROTOCOLS</span>
              <b>mDNS</b>
              <b>Easy IP</b>
              <b>VISCA</b>
              <b>ONVIF</b>
              <b>CAP / RCP2</b>
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
                <h3>Select a camera</h3>
                <p>Camera identity and connection details appear here.</p>
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
          {subnet}
          <i />
          {cameras.length} devices <span className="footer-version">v1.0</span>
        </span>
      </footer>
      <Dialog
        open={modal !== null}
        onOpenChange={(o) => {
          if (!o) setModal(null);
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
                <Button type="submit" disabled={manualBusy}>
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
                Connect this workspace to cameras on your workstation’s network.
              </DialogDescription>
              <div className="mode-switch">
                <Button
                  variant={mode === "demo" ? "secondary" : "ghost"}
                  onClick={() => {
                    cancelScan();
                    setMode("demo");
                    setCameras(demoCameras);
                    setSelected("demo-0");
                    setModal(null);
                  }}
                >
                  Demo workspace
                </Button>
                <Button
                  variant={mode === "local" ? "secondary" : "ghost"}
                  onClick={() => {
                    cancelScan();
                    setMode("local");
                    setCameras([]);
                  }}
                >
                  Live network
                </Button>
              </div>
              <ol className="helper-steps">
                <li>
                  <span>1</span>
                  <div>
                    <strong>Download the companion</strong>
                    <p>Requires Node.js 20 or later on the same network as your cameras.</p>
                    <Button variant="outline" size="sm" asChild>
                      <a href="/downloads/camera-finder-helper.cjs" download>
                        <Download />
                        Download helper
                      </a>
                    </Button>
                  </div>
                </li>
                <li>
                  <span>2</span>
                  <div>
                    <strong>Start it on your workstation</strong>
                    <code>node camera-finder-helper.cjs {origin}</code>
                  </div>
                </li>
                <li>
                  <span>3</span>
                  <div>
                    <strong>Pair this workspace</strong>
                    <p>
                      Paste the companion’s token. Allow local-network access when your browser
                      asks.
                    </p>
                    <input
                      aria-label="Companion pairing token"
                      type="password"
                      maxLength={100}
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      placeholder="Pairing token"
                      autoComplete="off"
                    />
                  </div>
                </li>
              </ol>
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
              {helperError && (
                <p className="form-error" role="alert">
                  {helperError}
                </p>
              )}
              <Button onClick={pair} disabled={!token || pairBusy}>
                {pairBusy ? <LoaderCircle className="spin" /> : <EthernetPort />}
                {pairBusy ? "Connecting…" : paired ? "Reconnect companion" : "Connect companion"}
              </Button>
            </>
          )}
          {modal === "export" && (
            <>
              <DialogTitle>Export / Patch sheet</DialogTitle>
              <DialogDescription>
                {filtered.length} cameras from your current view · {subnet}
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
        <h1>Camera Finder · Camera Patch Sheet</h1>
        <p>
          {subnet} · {mode === "demo" ? "SIMULATED DATA" : "Local discovery"} · {filtered.length}{" "}
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
