import { sameSubnet } from "@/lib/cameras";
import type { ScanNetwork } from "@/lib/scan-diagnostics";

export function outsideConnectedRanges(ip: string, networks: ScanNetwork[]): boolean | null {
  const known = networks.filter(n => n.address && n.cidr);
  if (!known.length) return null;
  return !known.some(n => n.address && n.cidr && sameSubnet(ip, n.address, n.cidr));
}