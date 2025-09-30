# Enish Menu & Admin Dashboard

A static multi-page menu experience for **Enish Restaurant & Lounge** paired with a modern admin dashboard that lets you review, edit, and export every menu section plus the weekly offers data.

## What this project includes

- **Customer-facing menus**: Seven themed HTML pages (Signature Cocktails, Classics, Spirits, Whisky & Cognac, Champagne & Wine, Beer & Aperitif, Miscellaneous) styled with `style.css` and progressively enhanced by `menu.js` and `offers.js`.
- **Weekly offers system**: `offers.json` feeds an offers modal, daily countdown, happy hour panel, and the floating "See Offers" trigger.
- **Admin dashboard**: `admin-dashboard.html` + `admin-dashboard.js` provide a GUI for editing menu items and offers, downloading updated HTML/JSON, and tracking unsaved changes.
- **Shared assets**: Brand imagery lives in `images/`.

## Quick start

1. Install a lightweight static server if you need one:
   ```bash
   npm install --global serve
   ```
2. From the project root, serve the site (both the public menus and the admin dashboard rely on HTTP fetch):
   ```bash
   serve .
   ```
3. Open `http://localhost:3000/index.html` for the customer menu or `http://localhost:3000/admin-dashboard.html` for the admin experience.

> **Why a server?** Browser security blocks `fetch()` on `file://` URLs. Running through `http://localhost` unlocks the menu auto-loader, offers modal, and admin editor.

## Admin workflow

1. Visit `/admin-dashboard.html` while the site is being served over HTTP.
2. Pick any menu page in the left navigation (or switch to Weekly Offers).
3. Edit names, descriptions, or prices inline. Add or remove items as needed.
4. When the save bar appears, choose **Download HTML/JSON** or **Copy** to export your changes.
5. Replace the downloaded file in this repository and commit as usual.
6. The reset button reverts the workspace to the latest saved snapshot.

## File map

| Path | Purpose |
| --- | --- |
| `index.html`, `classic.html`, `spirits.html`, `whisky.html`, `wine.html`, `beer.html`, `misc.html` | Customer-facing menu pages. |
| `style.css` | Global layout, theming, and animation rules. |
| `menu.js` | Navigation polish, sequential scroll loader, accessibility helpers. |
| `offers.js` | Floating offers trigger, modal, Dubai-time countdown, happy hour panel, confetti. |
| `offers.json` | Source data for the offers modal and admin dashboard. |
| `admin-dashboard.html` | Shell and styling for the admin interface. |
| `admin-dashboard.js` | Menu/offers editors, diff tracking, export helpers. |
| `images/ENISHLOGO.PNG` | Brand logo used across the site. |

## Code commentary

Detailed, line-level descriptions for every source file live in [`docs/CODE_COMMENTARY.md`](docs/CODE_COMMENTARY.md). Each table links code lines to their runtime behavior, making it easy to understand or audit functionality without combing through raw source.

## Contributing

- Fork or branch from `main`.
- Run a local server for development so `fetch()`-based features work.
- Update `offers.json` through the admin dashboard to keep snapshots consistent.
- Keep accessibility in mind (semantic markup, focus states, ARIA labels).

## License

No explicit license is set. Please request permission from Enish Restaurant & Lounge before republishing assets or menu content.
