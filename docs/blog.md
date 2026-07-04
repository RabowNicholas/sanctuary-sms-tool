# Flow State Blog — hand-back

The blog lives at `/blog` inside this app (public, SEO-friendly subdirectory).
It's file-based: **a post is one `.mdx` file in `content/blog/`, and shipping a
post is `git push`** (Vercel auto-deploys). No CMS, no database.

## MDX approach chosen (and why)

**`next-mdx-remote/rsc` + `gray-matter` + `zod`.**

- Runtime RSC compile → **no webpack loader / `next.config.ts` changes**, so it
  works with the existing `next build --turbopack` pipeline and adds no
  concurrent content-build watcher (which Velite would).
- A new `.mdx` file is picked up by a filesystem glob, so posts appear with
  **zero code changes**.
- `gray-matter` parses frontmatter; `zod` validates it; invalid frontmatter
  **throws during build** (see below).

> ⚠️ **Pinned to `next-mdx-remote@5`, not 6.** Version `6.0.0` has a regression
> that silently drops JSX **expression** props in MDX — e.g.
> `<ComparisonTable ids={[...]} />` arrives with `ids === undefined`. v5
> preserves them. Do not bump to 6 until that's fixed upstream.

## How to add a post (3 steps)

1. Create `content/blog/my-slug.mdx`. The **filename must equal the frontmatter
   `slug`** (enforced at load).
2. Fill the frontmatter (all required fields validated by
   `src/lib/blog/schema.ts`). Set `status: draft` while writing —
   drafts are hidden from `/blog` and the sitemap but viewable by direct URL in
   `npm run dev`. Flip to `status: published` to go live.
3. `git push`. That's it.

Use any component directly in the body (no imports): `<ProductCard id="" />`,
`<ComparisonTable ids={[]} />`, `<PackingChecklist items={[]} />`,
`<EmailOptin magnet="" />`, `<Experience where="" when="" photo="" />`,
`<ProTip>…</ProTip>`, `<FieldNote>…</FieldNote>`. `<FTCDisclosure/>` auto-renders
above the fold whenever `affiliateDisclosure: true`.

See `content/blog/best-earplugs-for-raves.mdx` for a full working example that
exercises every component.

## Where to put real affiliate URLs

**One file:** `content/products/products.ts`. Each product's `affiliateUrl` is a
`"#TODO-<id>"` placeholder. Swap in the real tracking link and every `<a>` on the
site updates, because all outbound affiliate links route through
`/go/[id]` (302 redirect, `rel="sponsored"`, `X-Robots-Tag: noindex`). While a
URL is still a placeholder, `/go/<id>` returns **503** instead of redirecting to a
dead link — that's expected until you fill it in.

## Where to put hero / event images

`public/blog-images/`. Reference them in frontmatter `hero.src` (e.g.
`/blog-images/earplugs-hero.jpg`) and in `<Experience photo="/blog-images/…">`.
The current `earplugs-hero.jpg` is a generated **placeholder** — replace it with a
real event photo.

## TODO: wire `<EmailOptin>` to your ESP

`src/components/blog/EmailOptin.tsx` is a **stub**. The capture UI works and it
POSTs `{ email, magnet }` to `process.env.NEXT_PUBLIC_ESP_ENDPOINT` when set;
otherwise it just shows the success state. To go live: set
`NEXT_PUBLIC_ESP_ENDPOINT` and confirm the POST body matches your ESP
(ConvertKit / Beehiiv / Mailchimp), then remove the TODO comment.

## Two things to know before shipping

1. **Domain:** all canonical/OG/sitemap URLs come from `NEXT_PUBLIC_SITE_URL`
   (default `https://flowstateslc.live`). Confirm this repo's Vercel project
   actually serves `flowstateslc.live` — the whole SEO-subdirectory benefit
   depends on it. Set `NEXT_PUBLIC_SITE_URL` in Vercel env if the domain differs.
2. **Pre-existing build blockers (not from the blog):**
   - `npm run build` runs `prisma db push --accept-data-loss` against
     `DATABASE_URL` before `next build`. The blog needs no DB, but be careful
     which database that env points at when you build.
   - There are pre-existing TypeScript errors in `__tests__/` (jest mock typing).
     Because `tsconfig.json` includes `**/*.ts` and `ignoreBuildErrors: false`,
     `next build`'s typecheck may fail on those — unrelated to the blog code,
     which is type-clean. Resolve or exclude the test files from the build
     typecheck before relying on a clean Vercel build.

## What was verified (in `npm run dev`)

- `/blog` lists published posts, filters by category, excludes drafts.
- `/blog/best-earplugs-for-raves` renders all components, dark-styled, 200 OK.
- Invalid frontmatter → build/render fails with a clear zod error naming the file.
- `/go/loop-experience` → 302 to the product URL + `X-Robots-Tag: noindex` (once a
  real URL is set); unknown id → 404; placeholder → 503.
- Every affiliate link routes through `/go/` with `rel="sponsored nofollow"`;
  FTC disclosure renders above the fold.
- Correct `<title>`, meta description, canonical, and valid Article + Product +
  ItemList JSON-LD. `/sitemap.xml` and `/robots.txt` generated; drafts excluded.
