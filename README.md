# SongBook — ChordPro songbook PWA (Google Drive storage)

Zero-build static web app. Installable from the browser (no app store). Songs are stored as `.cho` files in a "SongBook" folder in the signed-in user's own Google Drive.

## Setup
1. Google Cloud Console → new project → enable **Google Drive API**.
2. OAuth consent screen (External) → add scopes `openid`, `profile`, `drive.file` (non-sensitive, no verification review).
3. Credentials → **OAuth client ID → Web application**. Add Authorized JavaScript origins: your production URL and `http://localhost:8080`.
4. Paste the client ID into `js/config.js`.
5. Local test: `npx serve -l 8080 .` — Deploy: upload the folder to any HTTPS static host (Netlify, Cloudflare Pages, GitHub Pages, Firebase Hosting).
6. Open on your phone → Add to Home Screen.

## Notes
- `drive.file` means the app only sees files it created; each user gets a private library.
- Sign-in lasts the browser session (token in sessionStorage, ~1 hour); re-tap "Continue with Google" when it expires.
- Supported ChordPro: title, artist, key, capo, comments, chorus/verse/bridge/tab sections, `[Chord]` inline, transposition.
- Cache: bump `V` in `sw.js` when you change the shell file list.
