// 共通 HTTP ユーティリティ：タイムアウト・リトライ・ホスト単位の簡易レート制限
const UA = 'ArtAtlas/0.1 (personal non-commercial study app; https://github.com/novatky-cyber/art-atlas)';
const lastHit = new Map();
const MIN_INTERVAL_MS = { 'collectionapi.metmuseum.org': 120, 'api.artic.edu': 250, default: 150 };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const stats = { requests: 0, failures: 0 };

export async function getJson(url, { headers = {}, retries = 3 } = {}) {
  const host = new URL(url).host;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const wait = (MIN_INTERVAL_MS[host] ?? MIN_INTERVAL_MS.default) - (Date.now() - (lastHit.get(host) ?? 0));
    if (wait > 0) await sleep(wait);
    lastHit.set(host, Date.now());
    stats.requests++;
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, 'AIC-User-Agent': UA, Accept: 'application/json', ...headers },
        signal: AbortSignal.timeout(30000),
      });
      if (res.status === 404) return null;
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { fatal: true });
      return await res.json();
    } catch (e) {
      stats.failures++;
      if (e.fatal || attempt === retries) {
        console.warn(`  ! ${url.slice(0, 140)} -> ${e.message}`);
        return null;
      }
      await sleep(1000 * 2 ** attempt);
    }
  }
  return null;
}
