import { describe, expect, it, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import CameraFinder from "@/components/camera-finder";
import { initialDiscoveryMode, parseTarget } from "@/lib/discovery";
afterEach(cleanup);
describe("Live Discovery", () => {
  it("defaults to live with no sample cameras until Demo Sandbox is explicitly selected", () => {
    expect(initialDiscoveryMode).toBe("local");
    const { container } = render(<CameraFinder />);
    expect(container.querySelectorAll(".camera-table tbody tr")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Demo Sandbox" }));
    expect(container.querySelectorAll(".camera-table tbody tr")).toHaveLength(10);
    fireEvent.click(screen.getByRole("button", { name: "Live Discovery" }));
    expect(container.querySelectorAll(".camera-table tbody tr")).toHaveLength(0);
  });
  it("accepts the requested camera address directly", () => {
    expect(parseTarget("192.168.1.147")).toEqual(["192.168.1.147"]);
  });
  it("expands a bounded IP range inclusively", () => {
    expect(parseTarget("192.168.1.147 - 192.168.1.149")).toEqual([
      "192.168.1.147",
      "192.168.1.148",
      "192.168.1.149",
    ]);
  });
  it("sweeps /24 host addresses without network and broadcast addresses", () => {
    const ips = parseTarget("192.168.1.0/24");
    expect(ips).toHaveLength(254);
    expect(ips[0]).toBe("192.168.1.1");
    expect(ips.at(-1)).toBe("192.168.1.254");
  });
  it("rejects oversized sweeps", () => {
    expect(() => parseTarget("192.168.1.1 - 192.168.2.2")).toThrow("256");
  });
  it("rejects nonprivate addresses", () => {
    expect(() => parseTarget("8.8.8.8")).toThrow("private");
  });
  it("rejects reversed ranges", () => {
    expect(() => parseTarget("192.168.1.149 - 192.168.1.147")).toThrow("ascending");
  });
});
