// Desktop installer links. Set VITE_DESKTOP_RELEASES_URL to your GitHub releases page,
// e.g. https://github.com/OWNER/REPO/releases/latest/download
export const releasesBase = (import.meta.env["VITE_DESKTOP_RELEASES_URL"] as string | undefined)?.replace(/\/$/, "") || "https://github.com/KitG12/ptzIP/releases/latest/download";
export const installers = {
  mac: releasesBase ? `${releasesBase}/ptzIP-mac.dmg` : "",
  win: releasesBase ? `${releasesBase}/ptzIP-win.exe` : "",
};
export type DesktopBridge = { token: string; version: string };
export function desktopBridge(): DesktopBridge | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { ptzipDesktop?: DesktopBridge }).ptzipDesktop ?? null;
}
