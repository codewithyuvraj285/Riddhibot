# Riddhix chatbot backend: setup (about 15 minutes)

The website is static (GitHub Pages is fine). The AI and Google Sheets work happens in a **Google Apps Script Web App**
(`backend/Code.gs`) that runs under your Google account. No secret ever goes into the website files.

## 0. Check your spreadsheet first
Your link has `rtpof=true`, which usually means the file is an uploaded **.xlsx stored in Drive**, not a native Google Sheet.
Apps Script cannot write to it until it is converted: open it, **File -> Save as Google Sheets**, and use the new copy.
I could not open your sheet from my environment, so the code reads your real headers at runtime instead of assuming them (see "How it adapts").

## 1. Create the script
1. Go to https://script.google.com -> **New project**. Name it "Riddhix Chat Backend".
2. Replace the contents of `Code.gs` with `backend/Code.gs`.
3. Project Settings -> tick **Show "appsscript.json" manifest file**; replace it with `backend/appsscript.json` (sets Asia/Kolkata).
4. Project Settings -> **Script properties** -> add:

| Property | Value |
|---|---|
| `SPREADSHEET_ID` | the long ID in your sheet URL between `/d/` and `/edit` |
| `ANTHROPIC_API_KEY` | your key from console.anthropic.com (only ever stored here) |
| `MODEL` | optional; default `claude-sonnet-5-5`. Change if your account uses another model |
| `CLIENT_TOKEN` | optional random string; if set, put the same value in `js/config.js` -> `clientToken` |
| `DAILY_AI_LIMIT` | optional; max AI calls per day (default 500). This caps your API bill |
| `GLOBAL_PER_MIN` | optional; max requests per minute across all visitors (default 120) |

5. Select `checkSetup` in the toolbar -> **Run**. Approve the Google permissions. The log must list your three tab names.

## 2. Deploy
**Deploy -> New deployment -> Web app**: Execute as **Me**, Who has access **Anyone**. Copy the `/exec` URL.
(Visitors are anonymous, so "Anyone" is required. The spreadsheet itself is NOT made public; only this script can write to it.)
After any later code change use **Deploy -> Manage deployments -> Edit -> New version**; the URL stays the same.

## 3. Connect the website
Edit `js/config.js`: paste the `/exec` URL into **both** `chatEndpoint` and `leadEndpoint` (same URL), and `clientToken` if you set one.
Visit `<exec URL>` in a browser: you should see `{"ok":true,"service":"riddhix-chat",...}`.

## 4. Publish the site (GitHub Pages, as in README.md)
Upload everything except `backend/` and `tests/` (they are harmless but not needed publicly). Keep `.nojekyll`.

## How it adapts to your sheet
- Tabs are matched by name ignoring case/spaces/punctuation: **All Leads** (or Leads), **Chat History**, **Requirements**, optional **Instructions**.
- Columns are matched by header text (e.g. "Client Name"/"Name", "Date & Time"/"Date"), in any order, and the header row may be any of rows 1-5.
- A missing **tab** is created with the standard headers. A missing **column** is skipped and reported in the response `setup_notes` (never silently).
- If **Lead Status** has a dropdown, the first value starting with "New" is used for new leads. Otherwise `New`.
- **Instructions** tab text (up to 4000 chars) is added to the AI's prompt.
- Existing rows are updated, never duplicated. Status, Priority, Assigned Person and Follow-up Date are only filled when blank, so your team's edits are never overwritten.
- Conventions I chose (change in `Code.gs` if yours differ): Sender = `Customer`/`Assistant`; Report Status = `Draft`, `Final`, `Incomplete - visitor left`, `Draft (no AI report)`; Priority (set at finalize) = High/Medium/Low from how complete the lead is.
- All cells are written as text, so a visitor cannot inject spreadsheet formulas. Timestamps are `yyyy-MM-dd HH:mm:ss` in Asia/Kolkata.

## Security notes (be aware)
- `clientToken` and the honeypot only deter casual spam; anyone can read them in the page source. Real protection is: input validation, size limits, per-conversation (60/hour) and global rate limits, the daily AI cap, and idempotent writes.
- Apps Script cannot read the request Origin, so it cannot restrict by website domain.
- Visitor email/phone are unverified (guest data). Review the privacy wording with your lawyer; the chat tells visitors what is stored.
- Apps Script web apps have Google quotas (concurrency and daily URL-fetch limits). For high traffic, move the same logic to a server/cloud function.

## Testing the backend without deploying
`node backend/test/run-tests.js` runs the real `Code.gs` against an in-memory fake of Sheets/Cache/Lock/UrlFetch (24 tests).
`python3 tests/ui-tests.py` runs the browser tests (needs `pip install playwright` and `playwright install chromium`).
