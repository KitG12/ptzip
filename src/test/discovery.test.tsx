import { describe, expect, it, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import CameraFinder from "@/components/camera-finder";
import { initialDiscoveryMode, parseTarget } from "@/lib/discovery";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
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
  it('requires pairing before network traffic and remembers the requested scan', () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    render(<CameraFinder />);
    fireEvent.click(screen.getByRole('button', {name: 'Scan Network'}));
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
  it('does not start a cancelled pending scan after later pairing', async () => {
    const fetch = vi.fn().mockResolvedValue({ok:true,json:async()=>({connected:true})});
    vi.stubGlobal('fetch',fetch);
    render(<CameraFinder />);
    fireEvent.click(screen.getByRole('button',{name:'Scan Network'}));
    fireEvent.keyDown(screen.getByRole('dialog'),{key:'Escape'});
    await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
    fireEvent.change(screen.getByLabelText('Companion pairing token'),{target:{value:'test-token'}});
    fireEvent.click(screen.getByRole('button',{name:'Pair companion'}));
    await waitFor(()=>expect(fetch).toHaveBeenCalledTimes(1));
    expect(fetch.mock.calls[0]?.[0]).toBe('http://127.0.0.1:3344/health');
    await waitFor(()=>expect(screen.queryByRole('button',{name:'Stop Scan'})).toBeNull());
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
