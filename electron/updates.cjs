// Native-only release check. No camera information or credentials leave the computer.
const RELEASE_API = 'https://api.github.com/repos/KitG12/ptzIP/releases/latest';
function parts(version) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(version);
  return match ? match.slice(1).map(Number) : null;
}
function newer(latest, installed) {
  const a = parts(latest), b = parts(installed);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false;
}
function releaseResult(data, installed, platform) {
  if (data.draft || data.prerelease || !parts(data.tag_name || '')) throw Error('No stable release available.');
  const file = platform === 'darwin' ? 'ptzIP-mac.dmg' : platform === 'win32' ? 'ptzIP-win.exe' : null;
  const expected = `https://github.com/KitG12/ptzIP/releases/download/${data.tag_name}/${file}`;
  const asset = Array.isArray(data.assets) ? data.assets.find(a => a.name === file && a.browser_download_url === expected) : null;
  const available = newer(data.tag_name, installed);
  if (available && !asset) throw Error('The latest installer is not ready for this computer.');
  return { installed, latest: data.tag_name.replace(/^v/, ''), available, url: asset ? expected : '', checkedAt: new Date().toISOString() };
}
async function checkRelease(installed, platform, fetcher = fetch) {
  const response = await fetcher(RELEASE_API, { headers: { Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(10000), redirect: 'error' });
  if (!response.ok) throw Error('Could not check updates. Try again when connected to the internet.');
  return releaseResult(await response.json(), installed, platform);
}
module.exports = { newer, releaseResult, checkRelease };