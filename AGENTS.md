<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## ptzIP architecture
- Keep network validation in a browser-safe shared module so simulated PTZ changes are tested.
- Real LAN discovery uses the downloadable origin-and-token-restricted loopback companion because the hosted app cannot access workstation UDP networks.
- Keep the old helper download URL compatible with the branded helper; both copies must implement the same validated bounded scan targets.
- Automatic scans enumerate private IPv4 interfaces in the local companion, with local /24 bounds on large networks; browsers must never fabricate connected interfaces or bypass pairing.
- Keep the companion read-only until tested vendor adapters exist; never imply a simulated action modifies physical devices.
- Panasonic discovery reimplements the EasyIP UDP request/announcement (10670→10669) from documented facts only, read-only; reconfiguration packets are never sent.
- UDP vendor searches send from a socket bound to each adapter address so limited broadcasts leave every adapter (macOS otherwise uses only the default route); scans return per-method diagnostics.
- Camera records are session-only; local discovery does not need cloud persistence.
- Desktop installation uses manifest-only PWA support with bundled icons; do not add an app-shell service worker unless offline use is requested, to avoid stale preview caches.
- The web page is only a download page; the scanner UI renders solely inside the Electron shell (detected via the preload bridge), and the Demo Sandbox is not shown.
- The Electron desktop shell loads the published web app and forks the same read-only helper with an injected token exposed via preload, so desktop users auto-pair; installers are built only in GitHub Actions (electron-builder), never in the Lovable build.
