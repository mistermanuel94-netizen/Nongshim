# Deployment

## What is produced

`npm run build` writes a `dist/` directory of 223 static HTML pages plus hashed
assets. There is no server component, no database and no runtime dependency.

```bash
npm ci
npm run build          # validate-content -> astro build -> generate-redirects
npm run preview        # serve dist/ locally
```

`dist/` also contains `_redirects` and `_headers`, which Netlify and Cloudflare
Pages read directly from the publish directory. `deploy/` contains the same
rules in every other host's format.

## Before the first deploy

**Set the production origin.** `SITE_URL` drives every canonical tag, the
sitemap, Open Graph URLs and the JSON-LD `@id` graph. It defaults to
`https://eng.nongshim.com`.

```bash
SITE_URL=https://eng.nongshim.com npm run build
```

Deploying with the wrong `SITE_URL` produces canonicals pointing at the wrong
host, which is the single most damaging misconfiguration available here. Verify
after the first build:

```bash
grep -o '<link rel="canonical" href="[^"]*"' dist/index.html
```

**Optionally set the contact endpoint.** The enquiry form posts to
`PUBLIC_CONTACT_ENDPOINT`. Without it the page renders the published phone
number and postal address and says the online form is not connected — it never
shows a form that discards input.

```bash
PUBLIC_CONTACT_ENDPOINT=https://forms.example.com/nongshim npm run build
```

## Host configuration

The redirect map is 1,074 rules, 1,026 of which match on a query string
(`?recipeId=`, `?brandId=`, `?prodCode=`, `?tabType=`). Query-string matching is
where hosts differ most, which is why the configuration is generated rather than
hand-maintained in four formats.

### Netlify

Publish `dist/`. `_redirects` and `_headers` are already inside it.

```toml
# netlify.toml
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  SITE_URL = "https://eng.nongshim.com"
```

Netlify matches query parameters as conditions on the redirect line, so all
1,074 rules work as generated. The trailing `/* /404.html 404` rule gives
unmatched paths a real 404 status.

### Vercel

Copy `deploy/vercel.json` to the repository root. It sets `trailingSlash: true`
and expresses query-string redirects with `has: [{ type: "query", ... }]`.

```bash
cp deploy/vercel.json ./vercel.json
```

Vercel serves `dist/404.html` for unmatched paths with a 404 status
automatically. Add the security headers from `deploy/_headers` to the
`headers` array — they are not read from `_headers` on Vercel.

### Cloudflare Pages

Publish `dist/`; `_redirects` and `_headers` are read from it.

**Cloudflare's `_redirects` ignores the query string.** The 48 path-only rules
work; the 1,026 query-string rules do not. Two options, both documented in
`deploy/cloudflare-pages_redirects`:

1. **Bulk Redirects** (recommended): upload `deploy/redirects.csv` — it is
   already in the `source,target,status` shape the dashboard expects.
2. **A Worker** in front of Pages that reads the same CSV.

Without one of these, ~1,000 legacy URLs return 404 instead of redirecting.
Do not skip this step.

### Apache

```apache
Include /path/to/deploy/redirects.htaccess
```

Uses `RewriteCond %{QUERY_STRING}` for the query-based rules, and appends `?` to
each target so the original query string is not carried through.

### Nginx

```nginx
include /path/to/deploy/redirects.nginx.conf;
```

Path-only rules become `location = ... { return 301 ...; }`. Query rules are
grouped by path with an `if ($args = "...")` per rule.

## Headers

`deploy/_headers` (also written into `dist/`) sets:

| Header | Value |
| --- | --- |
| `Content-Security-Policy` | `default-src 'self'` plus `frame-src` for YouTube and Google Maps |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `X-Frame-Options` | `DENY` |
| `Permissions-Policy` | camera, microphone, geolocation and FLoC all denied |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |

The CSP allows exactly what the site loads. `style-src` includes
`'unsafe-inline'` because Astro inlines the stylesheet and emits scoped
`<style>` blocks; `script-src` is `'self'` with no inline allowance, and the
site loads no third-party script at all.

**Do not enable HSTS preload until you are certain every subdomain of
`nongshim.com` serves HTTPS.** Preload is very hard to undo. Deploy with a short
`max-age` first, confirm, then raise it.

## Caching

| Path | Cache-Control |
| --- | --- |
| `/_assets/*` | `public, max-age=31536000, immutable` |
| `/fonts/*` | `public, max-age=31536000, immutable` |
| HTML | `public, max-age=0, must-revalidate` |

Asset filenames contain a content hash, so they are safe to cache forever; HTML
must revalidate so a redeploy is visible immediately.

Ensure the CDN serves **brotli** for HTML, CSS, JS, JSON and XML. Serving
uncompressed costs roughly 7 Lighthouse points — that was measured during this
project when the test rig was not compressing.

## The 404

`dist/404.html` must be served with a real **HTTP 404** status. Netlify,
Vercel and Cloudflare Pages do this by convention. On Apache or Nginx set it
explicitly:

```apache
ErrorDocument 404 /404.html
```

```nginx
error_page 404 /404.html;
```

`npm run browser-test` asserts this against the test server; verify it in
production too. A 404 page served with a 200 status creates soft-404s.

## Verifying a deploy

```bash
# canonical points at the production origin
curl -s https://eng.nongshim.com/ | grep -o '<link rel="canonical"[^>]*>'

# a legacy recipe URL redirects with 301 to the right slug
curl -sI 'https://eng.nongshim.com/recipe/recipe_view?recipeId=17'

# a legacy product fragment redirects to the product page
curl -sI 'https://eng.nongshim.com/brand/main/container?brandId=shinramyun'

# an unknown path returns 404
curl -sI https://eng.nongshim.com/no-such-page/

# robots and sitemap resolve
curl -s https://eng.nongshim.com/robots.txt
curl -sI https://eng.nongshim.com/sitemap-index.xml

# compression and cache headers reached production
curl -sI -H 'Accept-Encoding: br' https://eng.nongshim.com/ | grep -i 'content-encoding\|cache-control'
```

## CI

Every quality gate exits non-zero on failure, so the pipeline is:

```yaml
- run: npm ci
- run: npm run lint
- run: npm run typecheck
- run: npm run build          # includes validate-content
- run: npm test
- run: npm run seo-audit
- run: npm run a11y-audit
- run: npm run browser-test   # needs Chrome
- run: npm run lighthouse     # needs Chrome
```

`browser-test` and `lighthouse` need a Chrome binary; on GitHub-hosted runners
`ubuntu-latest` already has one.

## Rollback

The build is deterministic from the repository, so a rollback is a redeploy of
the previous commit. Because HTML is `must-revalidate` and assets are
content-hashed, a rollback takes effect on the next request with no cache purge.

## Deliberate non-goals

| Not included | Why |
| --- | --- |
| Analytics | The source ran Google Tag Manager and Naver's `wcslog.js`. Neither is carried over; adding one is a business decision with a performance and privacy cost. See `docs/maintenance.md`. |
| A CMS | The content pipeline reads the public source. If Nongshim wants editorial control, the content models are plain JSON with a documented shape and would map onto any headless CMS. |
| Server-side search | The site is small enough that a 40 KB client index outperforms a network round trip. |
| Forms backend | Out of scope for a static rebuild; the endpoint is configurable. |
