# IT Wala Dai — Visual Admin (`/admin`)

A drag-and-drop editor for the live site. Pages stay plain static HTML; the admin edits them on the server
and writes the published result back into the same `index.html` files that are deployed today.

## 1. First-time setup

Requirements: Node 18+ (no npm packages needed for the admin) and Python 3 (used when publishing CMS content).

The admin is built into the normal dev server, so there is nothing extra to run:

```bash
npm run dev
```

Open <http://localhost:3000/admin> and sign in.

**Login.** One shared team login lives in `server/admin-account.json`. It is committed, but only as a scrypt hash.
Create or change it with:

```bash
npm run admin:set-password -- --shared
```

To use a private login on one computer instead, run `npm run admin:set-password` without `--shared`.
That writes `.env.admin`, which is git-ignored and takes precedence over the shared login.
Passwords need at least 10 characters.

`npm run admin` (a standalone server on port 4000) still works for hosting the admin on a server; see section 3.

## 2. Environment variables

All optional except the account. They can live in `.env.admin` or the real environment. Never commit them.

| Variable | Default | Meaning |
|---|---|---|
| `ADMIN_USERNAME` + `ADMIN_PASSWORD_HASH` | — | One account (written by `admin:set-password`) |
| `ADMIN_USERS` | — | More accounts: `user1:scrypt$…,user2:scrypt$…` |
| `ADMIN_HOST` / `ADMIN_PORT` | `127.0.0.1` / `4000` | Listen address. Keep 127.0.0.1 unless behind HTTPS |
| `COOKIE_SECURE` | off | `1` = session cookie only over HTTPS (set this in production) |
| `TRUST_PROXY` | off | `1` = use `X-Forwarded-For` for the login rate limit (behind nginx/Caddy) |
| `SESSION_IDLE_MINUTES` / `SESSION_MAX_HOURS` | 120 / 12 | Session lifetime |
| `MAX_UPLOAD_MB` | 8 | Image upload limit |
| `PYTHON` | `python` (Windows) / `python3` | Interpreter for `scripts/cms_render.py` |
| `ITWD_ROOT`, `ITWD_CONTENT_DIR`, `ITWD_ENV_FILE` | repo paths | Override locations (used by tests) |

## 3. Deployment options

**A. Edit locally, deploy with git (simplest, works with any static host).**
Run `npm run dev`, open `/admin`, edit and publish, then commit and push the changed HTML,
`assets/`, and `content/data`, `content/theme.json` and `content/*.json` files. The hosting stays static.

**B. Run the admin on a server (Node host / VPS).**
Run `node server/server.mjs` behind an HTTPS reverse proxy with `COOKIE_SECURE=1`, `TRUST_PROXY=1`, and
`ADMIN_HOST=127.0.0.1`. The same process serves the public site, so publishing is live immediately.
Back up `content/` and the page files. Sessions are kept in memory, so a restart signs everyone out.
**On a public server, set a private strong login (`.env.admin` or `ADMIN_*` env vars)**. The shared
team login in the repo is meant for local editing; anyone who can read the repo can try to guess it offline.

The static build/host never contains `/admin`'s backend. On a plain static host, `/admin` only shows the
admin page files and cannot log in or publish.

Private folders are never served: `content/drafts`, `content/revisions`, `content/private`, `content/unpublished`
(also blocked in Vite dev and git-ignored).

## 4. How to use it

- **Select / edit**: click any element. Double-click text to type on the page. The right panel has
  Content (text, link, image, icon, tag), Style (spacing, colours, typography, border, size, display) and Advanced (class, id, visibility per device).
- **Desktop / Tablet / Mobile**: the switch in the top bar changes the preview width *and* which
  breakpoint the Style values are saved for (tablet ≤1199px, mobile ≤767px).
- **Move**: drag the ⠿ handle in the element toolbar, or use Alt+↑/↓. Sections only move between sections.
- **Add**: the *Add* tab. Click an item to insert it after the selection, or drag it onto the page.
- **Duplicate / delete / copy / paste**: element toolbar, or Ctrl+D, Del, Ctrl+C, Ctrl+V. Undo/redo: Ctrl+Z / Ctrl+Y.
- **Drafts** autosave after 2–3 seconds. The live site does not change until you press **Publish**.
  Publishing validates the page first (broken links, missing images or alt text, unsafe HTML, mobile overflow).
- **Header & footer** are shared. Editing them on any page and publishing asks you to confirm, then
  updates all pages.
- **🔒 blocks** (course cards, testimonials, FAQs, projects, colleges, programmes, menus) come from
  **Content**. Edit them there. Publishing regenerates exactly the affected pages.
- **Media**: upload JPG/PNG/WebP/GIF/AVIF (SVG is refused for security), set alt text, and see where each image is used.
  Rename updates every reference. An image can only be deleted when nothing uses it.
- **History**: every publish keeps the previous live version (the last 60). Preview, compare or restore it.
- **Theme**: brand colours, fonts, base size, radius, shadows and motion. It is previewed in the editor and applied site-wide on publish.
- **Pages**: page settings (SEO title/description), duplicate to a new URL (starts unpublished),
  publish/unpublish admin-created pages. Existing pages keep their URL and cannot be unpublished from here.

## 5. Rules that protect the site

- Server-side login: scrypt hashes, HttpOnly + SameSite=Strict cookie, a CSRF token on every change,
  5 failed logins per 15 minutes per IP, and no secrets in the browser code.
- Scripts, iframes (except YouTube embeds), `on…` handlers, `javascript:`/`data:` links and unsafe styles are
  rejected by the server. Theme scripts that were already on a page stay untouched.
- Each element's Style values are saved as classes in `<style id="itwd-page-styles">` per page and
  `assets/itwd/editor-global.css` for the header/footer. Theme values are saved in `assets/itwd/theme-tokens.css`.
- Two tabs editing the same page get a conflict warning instead of overwriting each other.
- **Do not run `scripts/patch_site.py` after using the admin.** It refuses to run once `content/revisions/` exists
  (override: `--after-admin-edits`, then review the git diff). Structured content is in `content/data/*.json`;
  `python scripts/cms_render.py all` re-renders the 🔒 blocks from it.

## 6. Tests

```bash
npm test
```

Runs the API tests in `server/test/` against a temporary copy of the site, so the real files are never touched.

## 7. Known limitations

- Sessions are in memory (restart = sign in again). Single-server use only.
- Course detail pages (`/plus-two/<course>`) are fully generated from Content › Courses. Their body is locked in the visual editor.
- The `/programs` category cards with project counts and the contact details (phone/email) are not in the CMS yet.
- Testimonials and consultation requests still arrive by WhatsApp/email. The admin does not collect them.
- Existing URLs cannot be renamed (to avoid breaking links). Use Duplicate for a new URL.
