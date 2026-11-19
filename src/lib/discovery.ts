import { ipv4 } from "./cameras";
export const initialDiscoveryMode = "local" as const;
export function parseTarget(input: string): string[] {
  const n = (ip: string) => ip.split(".").reduce((v, x) => v * 256 + Number(x), 0);
  const format = (value: number) => [24, 16, 8, 0].map((s) => (value >>> s) & 255).join(".");
  const valid = (ip: string) =>
    ipv4.safeParse(ip).success && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);
  const target = input.trim();
  let first: number, last: number;
  if (target.includes("/")) {
    const [ip = "", prefix = ""] = target.split("/");
    const bits = Number(prefix);
    if (
      !valid(ip) ||
      !/^\d+$/.test(prefix) ||
      bits < 24 ||
      bits > 32 ||
      target.split("/").length !== 2
    )
      throw Error("Enter a private IPv4 subnet from /24 to /32.");
    const size = 2 ** (32 - bits);
    const base = Math.floor(n(ip) / size) * size;
    first = base + (bits <= 30 ? 1 : 0);
    last = base + size - 1 - (bits <= 30 ? 1 : 0);
  } else if (target.includes("-")) {
    const [a = "", b = ""] = target.split("-").map((v) => v.trim());
    if (!valid(a) || !valid(b) || target.split("-").length !== 2)
      throw Error("Enter two private IPv4 addresses separated by a dash.");
    first = n(a);
    last = n(b);
  } else {
    if (!valid(target))
      throw Error("Enter a private IP, CIDR subnet, or full start IP - end IP range.");
    first = n(target);
    last = first;
  }
  if (last < first || last - first + 1 > 256)
    throw Error("Choose an ascending range of at most 256 addresses.");
  const ips = Array.from({ length: last - first + 1 }, (_, i) => format(first + i));
  if (ips.some((ip) => !valid(ip))) throw Error("Only private IPv4 addresses may be scanned.");
  return ips;
}
