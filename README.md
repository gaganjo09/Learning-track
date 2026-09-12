# Daily Health Tracker

A calm, private daily health check-in. Dark glass interface, seven steps, about two minutes to fill.
Runs as a static site on GitHub Pages and saves each day's entry to Supabase.

---

## Files

```
index.html                 the form
css/styles.css             dark glass theme
js/app.js                  logic + Supabase config  ← edit this
sql/supabase_setup.sql     run once in Supabase
README.md                  this file
```

---

## Setup — 10 minutes

### 1. Create the database

1. Create a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor → New query**.
3. Paste everything from `sql/supabase_setup.sql` and press **Run**.
4. Check **Table Editor** — `daily_entries` should now exist.

### 2. Connect the app

In Supabase go to **Project Settings → API** and copy the **Project URL** and the **anon / public** key.

Open `js/app.js` and edit the first two lines:

```js
const SUPABASE_URL      = "https://abcdefgh.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";
```

That is the only edit needed anywhere.

### 3. Publish

1. Create a GitHub repository and upload all files, **keeping the folder structure**.
2. **Settings → Pages → Deploy from a branch**, branch `main`, folder `/ (root)`, **Save**.
3. Wait a minute. Your tracker is at `https://YOUR-USERNAME.github.io/YOUR-REPO/`

On iPhone: open in Safari → **Share → Add to Home Screen**. It then launches full-screen with no browser chrome, like a real app.

---

## How the date system works

**Calendar button, top right.** It looks like an iOS calendar tile — a mint strip with the month above, the day number large below. Tap anywhere on it and the native date wheel opens.

**Opens on today.** The tile shows today's date; the greeting top-left reads "Good morning", "Good evening" and so on depending on the hour.

**Pick any past date.** The tile strip turns amber so you can see at a glance you're not on today, and a **Back to today** chip appears beneath the header.

**Existing entries load and prefill.** Every chip and field is restored — including multi-selects and conditional fields. The greeting changes to the date ("Yesterday", "Mon 8 Sep") and the subtitle reads *"Picking up where you left off."* The save button becomes **Update Entry** and overwrites that row rather than duplicating.

**Empty dates** clear the form and show a rotating prompt like *"How did today treat you?"*

**Future dates are blocked** three ways: `max` on the picker, a JS guard that reverts with a warning, and a database `check (entry_date <= current_date)` constraint.

## Design guidelines

If you want to modify the look, these are the rules the interface follows.

### Colour

Everything lives in the `:root` block at the top of `css/styles.css`.

| Token | Value | Used for |
|---|---|---|
| `--ink` | `#0A1118` | Page base |
| `--mint` | `#5FD3A0` | Primary accent — selected states, primary button, progress |
| `--teal` | `#3FC0D4` | Secondary accent — Body and My Day icons, multi-select tags |
| `--violet` | `#9E8BF0` | Intimacy section — signals "private" |
| `--amber` | `#E8A94B` | Gut icon, and the "editing existing entry" state |
| `--rose` | `#E0736B` | Errors only |

Change `--mint` and the whole app re-themes. The others are section accents that keep screens from looking identical.

### Glass surfaces

Three depths, all built the same way — translucent white fill, hairline border, backdrop blur, and a 1px inner highlight along the top edge that simulates light catching a glass rim:

```css
background: rgba(255,255,255,.045);
border: 1px solid rgba(255,255,255,.09);
backdrop-filter: blur(20px) saturate(130%);
box-shadow: inset 0 1px 0 rgba(255,255,255,.06), 0 12px 40px rgba(0,0,0,.35);
```

`--glass` for cards and unselected chips, `--glass-2` for the date pill and Back button, `--glass-3` for hover.

Always pair `backdrop-filter` with `-webkit-backdrop-filter` — Safari still needs the prefix.

### Buttons

- **Primary** — mint gradient, dark text, mint glow beneath. One per screen, always the rightmost action.
- **Glass** — translucent, dim text. Secondary actions only.
- Both are 54px tall, scale to 0.97 on press, and show a 3px mint focus ring.

### Depth

Only three layers: the ambient background, the glass card, and the fixed nav bar. Resist adding more — flat glass on flat glass loses its effect.

The background is three coloured radial gradients over a dark diagonal base, plus an SVG noise layer at 3.5% opacity. The noise is what stops large dark areas from looking like flat colour.

### Motion

Steps slide 16px horizontally and fade, 340ms, on `cubic-bezier(.22,.61,.36,1)`. Direction reverses when going back. Conditional fields drop in over 280ms. The completion ring draws over 900ms, then the tick pops.

Nothing bounces. Nothing exceeds 900ms. Everything collapses under `prefers-reduced-motion`.

### iOS specifics

These are why it feels native rather than like a website:

- All inputs are **16px** — anything smaller makes Safari zoom on focus
- `viewport-fit=cover` plus `env(safe-area-inset-*)` so content clears the notch and home indicator
- `100dvh` instead of `100vh`, so the layout doesn't jump when Safari's toolbar hides
- `-webkit-tap-highlight-color: transparent` removes the grey flash on tap
- `apple-mobile-web-app-status-bar-style: black-translucent` lets the background run under the clock
- `overscroll-behavior-y: none` stops rubber-band bounce
- `navigator.vibrate()` gives a light tap on chip selection and a double-buzz on validation errors

### Typography

Inter, weights 400–900. Card titles are 22px/800 at `-0.025em` tracking. Labels 13.5px/600. Hints 11.5px. Section eyebrows are 11px uppercase at `0.14em`–`0.24em` tracking — wide letterspacing is what makes small caps read as deliberate rather than cramped.

### Icons

All icons live in one inline `<svg><defs>` sprite at the top of `index.html`, referenced with `<use href="#i-name"/>`. They're stroke-based on a 24×24 grid with `stroke-width: 1.6`, drawn as outlines with no fills except where a shape needs weight (battery level, pain intensity dots).

Icons carry meaning rather than decoration — battery fill for energy, gauge needle for stress, flame count for acidity, concentric dot size for pain intensity. Unselected they sit at `--text-mute`; selected they turn mint and scale to 1.08.

To add one: define `<g id="i-yourname">…paths…</g>` in the sprite, then use `<svg viewBox="0 0 24 24" class="ci"><use href="#i-yourname"/></svg>` inside a chip.

Where a number communicates faster than a picture — hours, kilometres, step counts — use `class="chip-num"` with a large `<span class="cn">` value and a small unit beneath, instead of an icon.

### Adding a question

1. Copy a `.field` block in `index.html`, give it a unique `data-field` and matching `data-name` on its chips.
2. Add the column to the SQL (`text`, or `text[]` for multi-select).
3. Add the name to `ALL_FIELDS` in `app.js`.

To make it required, add it to `REQUIRED` for its step. To make it conditional, add `class="conditional"`, `data-show-if="parent_field"`, `data-show-unless="value_that_hides_it"` and `hidden`.

---

## Exporting your data

Supabase → **Table Editor** → open the `daily_entries_flat` view → **Export → CSV**.

That view flattens the multi-select columns into plain text, so it opens cleanly in Excel or Sheets. Or run `select * from public.daily_entries_flat;` in the SQL Editor.

---

## Security

The anon key sits in `js/app.js`, which is publicly readable once deployed. Anyone who found your URL could write to the table. For a personal tracker at an unguessable URL this is usually fine — but it is **private, not secure**.

### Locking it down

1. Supabase → **Authentication → Providers** → enable **Email**.
2. Add an owner column:

```sql
alter table public.daily_entries
  add column if not exists user_id uuid references auth.users(id);
```

3. Replace the open policies:

```sql
drop policy if exists "anon read entries"   on public.daily_entries;
drop policy if exists "anon insert entries" on public.daily_entries;
drop policy if exists "anon update entries" on public.daily_entries;

create policy "own rows only"
  on public.daily_entries for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

4. Add a login screen and set `user_id` on insert — see the [Supabase Auth docs](https://supabase.com/docs/guides/auth).

---

## Troubleshooting

**"Supabase is not configured"** — the two constants in `js/app.js` still hold placeholder text.

**Page loads but nothing is clickable** — open the browser console (F12). If you see a red `SyntaxError`, a file is corrupted; re-upload. Never rename the `sbClient` variable in `app.js` to `supabase` — that name belongs to the CDN library and the collision silently kills the whole script.

**Unstyled page on GitHub Pages** — the folder structure was flattened on upload. `css/` and `js/` must remain subfolders beside `index.html`.

**"Could not save" with a permissions error** — the SQL didn't finish. Re-run `sql/supabase_setup.sql`.

**Past entries don't load** — the read policy is missing. Re-run the SQL.

**Changes don't appear after redeploy** — hard refresh with `Cmd/Ctrl + Shift + R`. GitHub Pages caches aggressively.

---

*A personal tracking tool. Not a medical device, and not a substitute for medical advice.*
