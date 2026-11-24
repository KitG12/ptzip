# ptzIP

This project was built with [Lovable](https://lovable.dev).

## Live Discovery

ptzIP starts with an empty device list in Live Discovery. No network requests are sent until you pair the local companion and choose a scan or manual IP query. Demo Sandbox is an explicit, separate sample-data workspace; its actions never configure physical devices.

1. Download `ptzip-helper.cjs` from the main screen.
2. Install Node.js 20+ and open a terminal in the download folder.
3. Run `node ptzip-helper.cjs https://YOUR-APP-ORIGIN` using the exact command shown by ptzIP.
4. Paste the terminal's pairing token into ptzIP and allow browser local-network access.
5. Click **Scan Network** to automatically scan connected private IPv4 interfaces. If you click before pairing, setup opens immediately and scanning starts when pairing succeeds. Leave the target blank for automatic selection, or enter a private IP, CIDR from /24 to /32, or full range such as `192.168.1.140 - 192.168.1.160`. Manual sweeps are limited to 256 addresses. Larger connected subnets are bounded to the interface's local /24 plus ONVIF announcements; use explicit ranges to check additional addresses. Use Manual IP to query an individual camera, such as `192.168.1.147`, with its web service port.

The read-only companion binds to `127.0.0.1:3344`, verifies the exact app origin and pairing token, and supports ONVIF discovery, HTTP camera identification, and TCP checks. It must run on the same computer as the browser and have access to the camera switch or routed VLAN. An open service without identifiable camera branding is not listed as a camera. Unknown MAC, serial and firmware values remain “Not reported”. Proprietary vendor UDP adapters and physical-camera network rewriting are not implemented. Cinema camera addresses must be set on the camera or via DHCP.

## Install ptzIP

Open the published app in Chrome or Edge and select **Install app**, or use Safari's **Add to Dock**. ptzIP opens in its own window with an app icon. Internet access is required; no offline service worker is installed. Previously installed copies may need removing and reinstalling for the updated ptzIP name to appear.

## Camera patch sheets

Export the current filtered view as `ptzIP-camera-patch-sheet.csv`, or choose **Print / Save PDF** and select **Save as PDF** in the print dialog. Demo exports are labelled simulated in the printable sheet.

## Build with Lovable

Open your project in the [Lovable editor](https://lovable.dev) and keep building.

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: connect the project to GitHub and every change made in Lovable is committed straight to your repository.
- **Full ownership**: this code is yours. Push to your repository and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS

## Desktop app (.dmg / .exe)

Crew can click **Get desktop app** to install ptzIP with built-in network scanning and no terminal setup. Installers are built by `.github/workflows/desktop-release.yml`: push a tag like `v1.0.0` from your connected GitHub repo, then set `VITE_DESKTOP_RELEASES_URL` to `https://github.com/OWNER/REPO/releases/latest/download` so the download buttons point at the release. Builds are unsigned unless you add Apple/Windows signing certificates.

### Connection and installer checks

The desktop workspace shows actual private IPv4 interface names, addresses and prefixes from the paired companion. Connections refresh every 15 seconds while idle and can be refreshed manually. Scans still search automatically; a local /24 sweep limit is not the full interface prefix. A camera outside all reported interface ranges is highlighted separately from an unanswered web port.

The installed native version comes from Electron, not the website version. The app checks the fixed public GitHub latest-release endpoint on opening and on request (native checks cached for one minute). It offers only the matching Mac or Windows asset from this repository, never installs automatically, and sends no camera or credential data. Offline or incomplete-release checks report an error rather than claiming the app is current. Older installers need one manual reinstall to gain this capability.

Run a new Desktop release workflow to publish v1.1.0; manual runs now use package.json's version so future native changes must bump that version. Publish the website changes separately.

### Remaining verification and signing

Camera Support lists implemented discovery methods, not certified models. Confirm each crew model with physical tests: Ethernet alone, Ethernet plus Wi-Fi, same range, Panasonic/Sony different range on the same switch, and password-protected browser controls. Save a scan report per case. No model is marked verified without this evidence.

Camera passwords are entered only into the camera's own page in the system browser. ptzIP does not collect or store them, and they do not belong in reports or exports. Automatic tally commands remain unavailable until a read-only-discovery-independent vendor adapter is safely tested, including guaranteed tally reset.

Installers remain unsigned. Signing needs the owner's Apple Developer account (Developer ID Application certificate and notarization credentials) and a Windows code-signing certificate or trusted signing service. Do not place certificates, passwords or keys in source. Configure them as GitHub Actions secrets when available; remove CSC_IDENTITY_AUTO_DISCOVERY=false only when Mac signing and notarization are configured and verify the resulting installers on real Mac/Windows machines before calling them signed.
