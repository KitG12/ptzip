import { useEffect, useState } from "react";
import { Apple, Monitor, Radar, ShieldCheck, Video, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import CameraFinder from "@/components/camera-finder";
import { desktopBridge, installers } from "@/lib/desktop";

// The scanner only works inside the desktop app; the web page is a download page.
export function DesktopGate() {
  const [desktop, setDesktop] = useState<boolean | null>(null);
  useEffect(() => setDesktop(!!desktopBridge()), []);
  if (desktop) return <CameraFinder />;
  const ready = !!installers.mac;
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12 text-foreground">
      <div className="w-full max-w-xl">
        <div className="mb-8 flex items-center gap-3">
          <span className="brand-symbol"><Video /></span>
          <h1 className="text-3xl font-semibold">ptzIP</h1>
        </div>
        <h2 className="text-2xl font-semibold">Camera discovery runs in the desktop app</h2>
        <p className="mt-3 text-muted-foreground">
          Web browsers can’t reach the cameras on your network. Install ptzIP on the computer
          connected to your camera switch — scanning is built in, with no setup.
        </p>
        <ul className="mt-8 space-y-4 text-sm">
          <li className="flex gap-3"><Radar className="shrink-0 text-primary" /><span>Finds PTZ, cinema and studio cameras on every connected network.</span></li>
          <li className="flex gap-3"><Zap className="shrink-0 text-primary" /><span>Open the app and press Scan Network — nothing to configure.</span></li>
          <li className="flex gap-3"><ShieldCheck className="shrink-0 text-primary" /><span>Read-only: scanning never changes camera settings.</span></li>
        </ul>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button size="lg" asChild={ready} disabled={!ready}>
            {ready ? <a href={installers.mac}><Apple />Download for macOS</a> : <span className="inline-flex items-center gap-2"><Apple />macOS — coming soon</span>}
          </Button>
          <Button size="lg" variant="outline" asChild={ready} disabled={!ready}>
            {ready ? <a href={installers.win}><Monitor />Download for Windows</a> : <span className="inline-flex items-center gap-2"><Monitor />Windows — coming soon</span>}
          </Button>
        </div>
        {!ready && <p className="mt-4 text-sm text-muted-foreground">Installers will be available here once the first release is published.</p>}
      </div>
    </main>
  );
}
