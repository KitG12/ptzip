# ptzIP

## Crew improvements
- [x] 2. Show actual connected interfaces before/during scans and highlight different address ranges.
- [x] 3. Show installed version, check releases and offer the correct installer.
- [x] Publish website — live at https://ptzip.lovable.app with the copyright credit and logo; download links serve the v1.1.0 installers.
- [x] v1.1.0 Desktop release — published on GitHub (run 4, commit c945cdd); Mac and Windows installers now serve from releases/latest.
- [ ] 1. Verified model support — blocked on model details and physical camera tests.
- [ ] 4. Tally identification — blocked on safely tested vendor adapters and physical cameras.
- [x] 5. Password-protected controls — retain camera-owned browser login without collecting or exporting credentials; physical camera login verification is pending.
- [ ] 6. Signed installers — blocked on Apple Developer and Windows signing certificates.

- [x] Sweep all discovery entry points, setup cancellation, scan results and network summaries.
- [x] Make Scan Network select connected interfaces automatically, prompt pairing visibly, and resume after pairing.
- [x] Test automatic interface targeting and paired scanning with real local responses.
- [x] Rename all app branding, installation metadata, exports and documentation to ptzIP.
- [x] Default to empty Live Discovery and explicit Demo Sandbox selection.
- [x] Show inline companion setup, command copy and connection status.
- [x] Validate and execute entered IP, CIDR and bounded IP ranges.
- [x] Verify live-first and paired manual/sweep flows.
- [x] Add and verify manifest-only desktop installation and branded icons.
- [x] Build the two-pane camera finder and adaptive inspectors.
- [x] Complete simulated scanning, filtering, manual add, PTZ validation and confirmation.
- [x] Connect a downloadable local discovery helper and web remote launcher.
- [x] Add CSV and printable patch sheets.
- [x] Test camera rules and desktop/tablet/phone flows.

## External limits

- Physical camera verification requires cameras on the user’s LAN. Companion pairing, HTTP identification, TCP check, remote launch and read-only safeguards were verified against a local test camera endpoint.
- Proprietary vendor UDP adapters and native Electron packaging are not included; live subnet rewriting remains unavailable by design until tested adapters exist.
- [x] Manual IP query shows reachable unidentified devices
- [x] Sony, Blackmagic (Bonjour) and Canon (XC web info) discovery
- [x] Show Single Cell Films LTD name and the supplied company logo in the copyright and ownership credit.
- [x] Add a zero-camera diagnosis with searched connections, method results, next steps and a complete report.
