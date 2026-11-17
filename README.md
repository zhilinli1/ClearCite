# ClearCite

A static study aid for IB, AP and BC students. Two jobs on one page:

1. **Check** — a policy-aware survey that returns a live verdict on a described use of AI: *Not allowed* · *Check with your teacher first* · *Allowed, cite it* · *Allowed, disclose it* · *No formal citation needed*. Each question carries a one-line explanation and examples, and is answered Yes or No; the questions are grouped by process (getting started, drafting, the final piece), not by severity.
2. **Cite** — choose the citation style first, then a citation generator with one-click copy for **MLA 9**, **APA 7**, **Chicago 18 (notes & bibliography)**, **Chicago 18 (author–date)** and an **IB transparency** format, plus a disclosure statement and a prompt annex.

Courses follow the curriculum: IB subject groups 1–6 and the DP core, AP's course areas, BC's subject areas, and a general list. Tools are grouped into official apps, official harnesses, third-party harnesses and aggregators; an official app fixes the model family, while a harness can run any family and takes an optional exact model name. Share links are checked for a subdomain or a non-share path and flagged in amber without blocking, and the address is trimmed the way the chosen style requires.

No frameworks, no build step, no CDN, no webfonts, no network requests. Five files and a folder. It works opened straight from disk (`file://`) and from a GitHub Pages subpath.

The interface is available in **English, 简体中文, 繁體中文, Français and Español**, chosen from the header and remembered in `localStorage`. Citations, disclosure statements and the policy excerpts stay in English: the citation styles describe English-language sources, and the policy quotations are reproduced as published. A note in the Policy section says so.

```
index.html   markup, survey containers, form, policy text
styles.css   design tokens and every component skin, light + dark + print
i18n.js      UI translations (English source strings as keys)
app.js       verdict engine, citation engine, state, rendering, events
.nojekyll    tells GitHub Pages to serve the files as they are
```

Everything you type stays in the browser. The saved list and your settings live in `localStorage` only.

## Deploying on GitHub Pages

**Project site** (`https://<user>.github.io/<repo>/`)

1. Push these files to the repository's default branch, in the root.
2. **Settings → Pages → Build and deployment**: Source *Deploy from a branch*, Branch `main`, folder `/ (root)`.
3. Wait for the first deployment; the site appears at `https://<user>.github.io/<repo>/`.

Every path in the project is relative (`styles.css`, `app.js`), so the `/repo/` prefix needs no configuration.

**User site** (`https://<user>.github.io/`)

1. Create the repository named exactly `<user>.github.io`.
2. Push the files to the root of the default branch and enable Pages the same way.
3. The site is served from `https://<user>.github.io/`.

`.nojekyll` prevents Jekyll from processing the folder and is required in both cases: without it, files and folders beginning with an underscore are dropped.

To test locally, open `index.html` directly. A local server (`python3 -m http.server`) is optional; nothing needs one.

## How the verdict logic is organised

`app.js` is ordered *constants → pure helpers → formatters → verdict → state → render → events → init*. Nothing touches the DOM outside `init()`, and the pure functions are exported on `window.ClearCite` (and via `module.exports`) so they can be tested in Node.

**Data.** `FLAGS` (the nine red-flag behaviours) carries a per-program severity map; `DIRECT_ITEMS` and `INDIRECT_IDS` describe whether AI output ended up in the work. `itemVisibleFor()` decides whether a row exists at all — `a4` only for BC, `a5` only for AP, `r7` only for language acquisition or a language-marked task, `r9` only for visual arts. A hidden row leaves the DOM and its answer is cleared.

**Resolution.** `flagSeverity()` resolves one flag for one program: `hard` is always `prohibited`; otherwise the program's entry is used, and a `summative`-gated flag drops to `context` when `a1` is unticked.

**Precedence.** `computeVerdict()` applies, in order: `prohibited > context > cite > disclose > note > none > empty`. Two details are deliberate:

- The program conditions are gated on use — `anyUse && (!a3 || (program === 'ap' && !a5))`. Without that gate every AP student would land in `context` before ticking anything and `empty` could never be reached.
- `conservative` can never suppress the `a3` transparency requirement. It only changes how indirect-only use is treated (`note` instead of `disclose`).

`computeVerdict()` returns the level, how citations should behave (`full`, `disclosure`, `full-after-approval`, `blocked`), the deduped remediation steps, the warnings (transparency, privacy, AP checkpoints) and the rule references rendered as the trail of source chips.

**Formatters.** Each style is one function taking a single plain object and returning `{ text, html, blocks, notes }`. `html` may contain only `<em>` and curly quotes; every user-entered value is escaped at the boundary. A missing required field returns a `pending` result so the panel can show one dashed placeholder instead of a half-built citation.

## Disclaimer

ClearCite is an independent study aid. It is not published or endorsed by the IB, the College Board or the BC Ministry of Education. Your school's policy and your teacher's instructions take precedence.
