import { useEffect, useState } from "react";
import { Apple, Monitor, MonitorDown, Radar, ShieldCheck, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { desktopBridge, installers } from "@/lib/desktop";

export function DesktopDownload() {
  const [open, setOpen] = useState(false);
  const [inDesktop, setInDesktop] = useState(false);
  useEffect(() => setInDesktop(!!desktopBridge()), []);
  if (inDesktop) return null;
  const ready = !!installers.mac;
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <MonitorDown />
        Get desktop app
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Install ptzIP for desktop</DialogTitle>
          <DialogDescription>
            The desktop app has direct hardware network scanning built in — zero configuration. No
            terminal, no runner command and no pairing token.
          </DialogDescription>
          <ul className="helper-steps">
            <li><span><Radar /></span><div><strong>Native discovery</strong><p>ONVIF multicast (UDP 3702) and HTTP camera identification across every connected network.</p></div></li>
            <li><span><Zap /></span><div><strong>Scan on launch</strong><p>Open ptzIP and press Scan Network. The scanner pairs itself automatically.</p></div></li>
            <li><span><ShieldCheck /></span><div><strong>Read-only</strong><p>Discovery never changes camera settings. Cinema addresses stay set on-camera or via DHCP.</p></div></li>
          </ul>
          <div className="pair-row">
            <Button asChild={ready} disabled={!ready}>
              {ready ? <a href={installers.mac}><Apple />Download for macOS (.dmg)</a> : <span className="inline-flex items-center gap-2"><Apple />macOS (.dmg)</span>}
            </Button>
            <Button asChild={ready} disabled={!ready} variant="outline">
              {ready ? <a href={installers.win}><Monitor />Download for Windows (.exe)</a> : <span className="inline-flex items-center gap-2"><Monitor />Windows (.exe)</span>}
            </Button>
          </div>
          {!ready && (
            <p className="form-error" role="status">
              Installers appear here after the first desktop release is published.
            </p>
          )}
          <p>After install, macOS may ask to allow ptzIP to find devices on your local network — choose Allow.</p>
        </DialogContent>
      </Dialog>
    </>
  );
}
