import { useState } from "react";
import { CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

const methods = [
  ["Panasonic", "EasyIP broadcast + HTTP", "Different ranges on the same physical network"],
  ["Sony", "VISCA broadcast + HTTP", "Different ranges on the same physical network"],
  ["Canon", "ONVIF, Bonjour + XC web information", "Reachable camera range"],
  ["Blackmagic", "Bonjour + HTTP", "Reachable camera range"],
];
export function CameraSupport() {
  const [open, setOpen] = useState(false);
  return <>
    <Button variant="ghost" size="icon" title="Camera support and verification" aria-label="Camera support and verification" onClick={() => setOpen(true)}><CircleHelp /></Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent>
      <DialogTitle>Camera support</DialogTitle>
      <DialogDescription>Discovery methods implemented · physical model verification pending</DialogDescription>
      <dl className="space-y-4">{methods.map(([brand, method, scope]) => <div key={brand}><dt className="font-semibold">{brand}</dt><dd className="text-sm text-muted-foreground">{method}<br />{scope}</dd></div>)}</dl>
      <p className="text-sm text-muted-foreground">No models are marked verified yet. A successful scan is not proof that every model or network arrangement works. Tally flashing remains unavailable until tested safely.</p>
    </DialogContent></Dialog>
  </>;
}