# Souqlik — souqlik.store

Static site, no build step. `index.html` is the storefront, `admin/index.html`
is the admin panel. Both talk directly to Firebase (Realtime Database +
Auth) and Cloudinary — nothing to build or bundle.

## 1. Push this to GitHub

```bash
cd souqlik-store
git init
git add .
git commit -m "Souqlik — storefront, admin, SEO"
git branch -M main
git remote add origin https://github.com/<your-username>/souqlik-store.git
git push -u origin main
```

No GitHub account yet? Create the empty repo first at
github.com/new (don't add a README there — this folder already has one),
then run the commands above.

## 2. Connect it to Vercel

If your existing Vercel project is already linked to a GitHub repo, the
easiest path is: push this code to *that* repo (replace its contents) and
Vercel redeploys automatically on every push to `main`.

Starting fresh instead:
1. vercel.com → **Add New → Project**
2. Import the `souqlik-store` GitHub repo
3. Framework preset: **Other** (it's static — no build command, no output
   directory needed)
4. Deploy

## 3. Point souqlik.store at it

In the Vercel project → **Settings → Domains** → add `souqlik.store` and
`www.souqlik.store`. Vercel will show you records like these (use the
*exact* values your dashboard shows — they're usually the same, but confirm):

| Type  | Host | Value                  |
|-------|------|-------------------------|
| A     | @    | `76.76.21.21`           |
| CNAME | www  | `cname.vercel-dns.com`  |

Add those two records at wherever `souqlik.store` is registered (your
registrar's DNS panel). Propagation is usually minutes, occasionally a
few hours. Vercel issues SSL automatically once it verifies.

## 4. After it's live — the actual "SEO and Geo" work

Meta tags get you discoverable; these get you *ranked*:

- **Google Search Console** (search.google.com/search-console) — add
  `souqlik.store`, verify (Vercel's DNS TXT method is easiest), then submit
  `https://souqlik.store/sitemap.xml`. This is the single highest-leverage
  step — Google won't rank pages it doesn't know exist.
- **Bing Webmaster Tools** — same idea, smaller payoff, five minutes.
- **Google Business Profile** — if you have a real pickup point, storage
  location, or registered address in Morocco, register it there. This is
  what actually drives "near me" / map-pack results — a website alone
  doesn't.
- Keep the product photos and prices in the admin panel filled in — empty
  "Item 01 — rename me" placeholders hurt more than they help once real
  crawlers see them.

## What's already wired in this repo

- `robots.txt` — allows everything except `/admin/`
- `sitemap.xml` — lists the homepage. The category and product pages are
  client-side routes (`#c-...`, `#p-...`); URL fragments aren't separately
  indexable, so they're intentionally left out rather than listed
  inaccurately. Real per-product SEO pages would need server-side
  rendering — a bigger project than this static setup, worth revisiting
  if organic product search traffic matters later.
- `site.webmanifest` + `/assets/icon-*.png` — installable as a home-screen
  app on phones.
- Open Graph + Twitter Card tags + `/assets/og-image.jpg` — a real preview
  image when the link is shared on WhatsApp, Facebook, etc. (this matters
  a lot for a WhatsApp-checkout shop specifically).
- `geo.region` / `geo.placename` meta tags — Morocco.
- One static `OnlineStore` JSON-LD block — business identity, not per-item
  (see sitemap note above for why).
- `admin/index.html` — `noindex, nofollow`, kept out of the sitemap.
- `firebase-setup/` — the seed data and security rules used for the
  one-time Firebase import. Not required for the site to run day to day;
  kept here for reference in case the database ever needs rebuilding.
  It'll deploy as public static files like everything else here (nothing
  in it is secret — Firebase API keys aren't meant to be hidden, the
  database rules are what actually enforce access), so this is just
  about tidiness, not security.

## What still needs a real decision from you

- **Product content.** All 13 imported items are still placeholders — see
  `souqlik-seed.json` from earlier. Search engines and customers see the
  same blank data right now.
- **True multilingual URLs.** Right now AR/FR/EN is one URL that switches
  client-side. That's fine for customers, but Google can only index and
  rank *one* version of that URL. If ranking separately for French vs.
  Arabic searches matters, the real fix is separate paths
  (`/fr/`, `/ar/`) or subdomains — a genuine restructuring, not a config
  change. Worth doing once you know which language drives more traffic.
