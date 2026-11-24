import { describe, expect, it } from "vitest";
import { outsideConnectedRanges } from "@/lib/connection-status";
const network = { name: "en7", target: "192.168.2.0/24", address: "192.168.2.20", cidr: 24, limited: false };
describe("camera address range highlighting", () => {
  it("flags 192.168.1.147 when the computer is on 192.168.2.0/24", () => { expect(outsideConnectedRanges("192.168.1.147", [network])).toBe(true); });
  it("does not flag cameras reachable through another connected range", () => {
    expect(outsideConnectedRanges("192.168.1.147", [network, { ...network, name: "en8", address: "192.168.1.20" }])).toBe(false);
  });
  it("uses the actual interface prefix rather than the bounded sweep", () => { expect(outsideConnectedRanges("192.168.1.147", [{ ...network, cidr: 16 }])).toBe(false); });
  it("does not fabricate network evidence for older companions", () => { expect(outsideConnectedRanges("192.168.1.147", [])).toBeNull(); });
});