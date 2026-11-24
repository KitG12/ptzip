import { createRequire } from "node:module";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { DesktopUpdate } from "@/lib/desktop";

const native = createRequire(resolve("package.json"))("./electron/updates.cjs") as {
  newer: (latest: string, installed: string) => boolean;
  releaseResult: (data: object, installed: string, platform: string) => DesktopUpdate;
  checkRelease: (installed: string, platform: string, fetcher: typeof fetch) => Promise<DesktopUpdate>;
};
const release = (tag = "v1.1.0") => ({ tag_name: tag, draft: false, prerelease: false, assets: [
  { name: "ptzIP-mac.dmg", browser_download_url: `https://github.com/KitG12/ptzIP/releases/download/${tag}/ptzIP-mac.dmg` },
  { name: "ptzIP-win.exe", browser_download_url: `https://github.com/KitG12/ptzIP/releases/download/${tag}/ptzIP-win.exe` },
] });
describe("native installer update checks", () => {
  it("offers 1.1.0 to a 1.0.0 installer", () => { expect(native.newer("v1.1.0", "1.0.0")).toBe(true); });
  it("compares version numbers rather than text", () => { expect(native.newer("v1.10.0", "1.9.0")).toBe(true); });
  it("never offers a downgrade or equal version", () => {
    expect(native.newer("v1.0.0", "1.1.0")).toBe(false);
    expect(native.newer("v1.1.0", "1.1.0")).toBe(false);
  });
  it("selects the Mac installer", () => { expect(native.releaseResult(release(), "1.0.0", "darwin").url).toBe("https://github.com/KitG12/ptzIP/releases/download/v1.1.0/ptzIP-mac.dmg"); });
  it("selects the Windows installer", () => { expect(native.releaseResult(release(), "1.0.0", "win32").url).toBe("https://github.com/KitG12/ptzIP/releases/download/v1.1.0/ptzIP-win.exe"); });
  it("rejects an untrusted installer URL", () => {
    expect(() => native.releaseResult({ ...release(), assets: [{ name: "ptzIP-mac.dmg", browser_download_url: "https://example.com/untrusted.dmg" }] }, "1.0.0", "darwin")).toThrow("not ready");
  });
  it("excludes prereleases", () => { expect(() => native.releaseResult({ ...release(), prerelease: true }, "1.0.0", "darwin")).toThrow("stable"); });
  it("reports internet failures without claiming the installer is current", async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error("offline"));
    await expect(native.checkRelease("1.0.0", "darwin", fetcher)).rejects.toThrow("offline");
  });
  it("requests only the fixed public releases endpoint without camera data", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(release())));
    const result = await native.checkRelease("1.0.0", "darwin", fetcher);
    expect(result.available).toBe(true);
    expect(fetcher.mock.calls[0]?.[0]).toBe("https://api.github.com/repos/KitG12/ptzIP/releases/latest");
    expect(fetcher.mock.calls[0]?.[1]?.body).toBeUndefined();
  });
});