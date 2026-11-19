# ptzIP

This project was built with [Lovable](https://lovable.dev).

## Live Discovery

ptzIP starts with an empty device list in Live Discovery. No network requests are sent until you pair the local companion and choose a scan or manual IP query. Demo Sandbox is an explicit, separate sample-data workspace; its actions never configure physical devices.

1. Download `ptzip-helper.cjs` from the main screen.
2. Install Node.js 20+ and open a terminal in the download folder.
3. Run `node ptzip-helper.cjs https://YOUR-APP-ORIGIN` using the exact command shown by ptzIP.
4. Paste the terminal's pairing token into ptzIP and allow browser local-network access.
5. Enter a private IPv4 address, a CIDR from /24 to /32, or a full range such as `192.168.1.140 - 192.168.1.160`. Sweeps are limited to 256 addresses. Use Manual IP to query an individual camera, such as `192.168.1.147`, with its web service port.

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
