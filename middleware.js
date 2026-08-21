/**
 * Souqlik — per-product link previews.
 *
 * The storefront is a single static index.html; a product's "own page"
 * only ever existed as a URL hash (#p-item-05), and a hash never reaches
 * the server — WhatsApp, Instagram, Facebook, X, Telegram etc. all fetch
 * the URL server-side to build a preview card, so they only ever saw the
 * generic homepage tags baked into index.html, never the product's.
 *
 * Share links now point at a real path instead: /p/<id> (and /c/<id> for
 * a category). This middleware intercepts exactly those two paths, pulls
 * that one product's name/price/photo straight from the live database,
 * and serves the real index.html back with just the <head> meta swapped
 * in — for every visitor, bot or human, same file either way. A human's
 * browser then runs the page exactly as always; the client-side router
 * (see productShareUrl()/route() in index.html) already understands
 * /p/<id> and /c/<id> on first load and takes it from there.
 *
 * No framework, no dependencies, no build step — plain Web platform
 * APIs only (fetch/Response/URL), so this doesn't turn the project into
 * something that needs `npm install` to deploy. If anything below ever
 * fails (bad id, database unreachable, malformed data), it falls back to
 * serving the plain, unmodified page — never a broken one.
 */

const FIREBASE_DB = 'https://souqlik-1008f-default-rtdb.europe-west1.firebasedatabase.app';
const FALLBACK_IMAGE_PATH = '/assets/og-image.jpg';
const REQUEST_TIMEOUT_MS = 2500; /* a slow database must never hold up a real visitor's page load */

export const config = {
  matcher: ['/p/:id', '/c/:id']
};

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function firstNonEmpty(obj, keys) {
  if (!obj) return '';
  for (const k of keys) { if (obj[k]) return obj[k]; }
  return '';
}

async function fetchWithTimeout(url, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

/** Looks up one product across every category (products are only ever
 *  a few dozen for this shop, so one full fetch is simpler and just as
 *  fast as maintaining a second lookup index would be). */
async function findProductMeta(id, origin) {
  const res = await fetchWithTimeout(FIREBASE_DB + '/categories.json', REQUEST_TIMEOUT_MS);
  if (!res.ok) return null;
  const cats = await res.json();
  if (!cats || typeof cats !== 'object') return null;
  for (const catId in cats) {
    const items = (cats[catId] && cats[catId].items) || {};
    const it = items[id];
    if (it) {
      const name = firstNonEmpty(it.name, ['en', 'fr', 'ar']) || 'Souqlik';
      const hook = firstNonEmpty(it.hook, ['en', 'fr', 'ar']) || firstNonEmpty(it.desc, ['en', 'fr', 'ar']);
      const priceLine = it.price ? `${it.price} DH` : '';
      return {
        title: priceLine ? `${name} — ${priceLine}` : name,
        description: hook || 'A small souk, curated — cash on delivery across Morocco.',
        image: it.img || (origin + FALLBACK_IMAGE_PATH)
      };
    }
  }
  return null;
}

async function findCategoryMeta(id, origin) {
  const res = await fetchWithTimeout(FIREBASE_DB + '/categories/' + encodeURIComponent(id) + '.json', REQUEST_TIMEOUT_MS);
  if (!res.ok) return null;
  const cat = await res.json();
  if (!cat) return null;
  const name = firstNonEmpty(cat.name, ['en', 'fr', 'ar']);
  if (!name) return null;
  const note = firstNonEmpty(cat.note, ['en', 'fr', 'ar']);
  const firstItem = cat.items ? Object.values(cat.items).find((it) => it && it.img) : null;
  return {
    title: name,
    description: note || 'A small souk, curated — cash on delivery across Morocco.',
    image: (firstItem && firstItem.img) || (origin + FALLBACK_IMAGE_PATH)
  };
}

/** Swaps the handful of meta tags that matter for a link preview. Every
 *  replacement is scoped to one exact known tag from index.html, so this
 *  can't accidentally rewrite something unrelated elsewhere in the page. */
function injectMeta(html, meta, canonicalUrl) {
  const title = escapeHtml(meta.title) + ' — Souqlik';
  const desc = escapeHtml(meta.description);
  const image = escapeHtml(meta.image);
  const url = escapeHtml(canonicalUrl);

  return html
    .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/, `$1${desc}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${title}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${desc}$2`)
    .replace(/(<meta property="og:image" content=")[^"]*(")/, `$1${image}$2`)
    .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${url}$2`)
    .replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${title}$2`)
    .replace(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${desc}$2`)
    .replace(/(<meta name="twitter:image" content=")[^"]*(")/, `$1${image}$2`)
    .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${url}$2`);
}

export default async function middleware(request) {
  const url = new URL(request.url);
  const parts = url.pathname.split('/').filter(Boolean); // ['p', 'item-05'] or ['c', 'wellness']
  const kind = parts[0];
  const id = parts[1];
  if ((kind !== 'p' && kind !== 'c') || !id) return; // not our path — untouched, normal static handling

  let html;
  try {
    const pageRes = await fetch(new URL('/index.html', url.origin));
    if (!pageRes.ok) return;
    html = await pageRes.text();
  } catch (e) {
    return; // couldn't even fetch the base page — let Vercel serve it normally instead
  }

  let meta = null;
  try {
    meta = kind === 'p' ? await findProductMeta(id, url.origin) : await findCategoryMeta(id, url.origin);
  } catch (e) {
    meta = null; // database unreachable/slow/malformed — serve the plain page rather than fail
  }

  const finalHtml = meta ? injectMeta(html, meta, url.origin + url.pathname) : html;
  return new Response(finalHtml, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' }
  });
}
