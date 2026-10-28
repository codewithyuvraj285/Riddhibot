# Riddhix Technology website

Static site (HTML, CSS, JavaScript + three.js for the 3D hero). No build step needed.

## Put it online with GitHub Pages
1. Create a new repository on GitHub, e.g. `riddhix-website` (public).
2. Upload everything in this folder (index.html, css/, js/, assets/, .nojekyll) to the repository root.
3. Repository Settings -> Pages -> Source: "Deploy from a branch" -> Branch: `main`, folder `/ (root)` -> Save.
4. After a minute the site is live at `https://<your-username>.github.io/riddhix-website/`.

Custom domain: Settings -> Pages -> Custom domain, then add a CNAME record at your domain provider pointing to `<your-username>.github.io`.

## Things to edit
- `js/config.js`: enquiry email, chatbot backend URL, budget and timeline options.
- `index.html`: service text, sector list and footer details.
- `assets/`: logo files cropped from your logo.
- Colors are CSS variables at the top of `css/style.css`.

## Enquiry chatbot (js/chatbot.js)
- Opens as a full-screen chat from the nav ("Chat with AI"), the floating button, the footer and the contact section (any element with `data-chat-open`; `#chat` in the URL also opens it).
- **Guided mode** (default, `chatEndpoint` empty): answers from the site's own content, collects the enquiry, lets the visitor email it. Nothing is saved.
- **AI mode** (endpoints set): the AI converses, and `backend/Code.gs` saves leads, messages and the requirement report to your Google Sheet. Setup: `backend/SETUP.md`.
- Never put API keys or Google credentials in the front-end.

## Hero 3D
The 3D scene is auto-fitted to its panel (`FIT` in `js/main.js`). If three.js or WebGL is unavailable, an animated SVG orb is shown instead.

## Tests
`node backend/test/run-tests.js` (backend logic) and `python3 tests/ui-tests.py` (browser, needs Playwright).
