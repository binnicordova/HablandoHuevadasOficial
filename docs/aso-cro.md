# ASO & CRO — Six Quick Wins

Store-console changes. None of these can be made from the codebase; each is ready to paste.

---

## 1. Rewrite the title to carry the intent keyword

Most installs for this category come from people searching the *podcast name*, not the app name.
The title is the single heaviest ASO field on Google Play.

| | Current | Proposed |
|---|---|---|
| Play (30 chars) | `Hablando Huevadas` | `Hablando Huevadas: Podcast` |
| App Store (30 chars) | `Hablando Huevadas` | `Hablando Huevadas — Clips` |
| App Store subtitle (30) | — | `Episodios, shorts y racha` |

**Measure:** impression → page-view rate in Play Console's *Store listing acquisition*.

---

## 2. Fill the Play short description (80 chars) with the value promise, not the brand

The short description is the first thing above the fold and is indexed.

```
Todos los episodios y shorts de Hablando Huevadas. Un clip nuevo cada día.
```

73 characters. Leads with catalog completeness, closes with the daily-return reason.

---

## 3. Front-load the long description with keywords in the first 170 characters

Only the first ~3 lines are visible before "Read more", and Play weights early text.

```
Hablando Huevadas: los 535 episodios completos y más de 3,000 shorts de Jorge Luna
y Ricardo Mendoza, en una sola app. Un clip nuevo cada día, favoritos, y sigue
viendo donde lo dejaste.

QUÉ ENCUENTRAS
• Huevada del día: un clip elegido cada 24 horas
• Todos los episodios completos, buscables por invitado o título
• Feed de shorts vertical
• Guarda tus favoritos y retoma donde te quedaste
• Racha diaria: mantén tu racha viendo un clip al día
• Comparte a WhatsApp, TikTok o Instagram en un toque
• Funciona sin conexión para explorar el catálogo
```

Names both hosts (high-volume search terms) and states the real catalog size.

---

## 4. Rebuild the screenshot set — this is the highest-leverage CRO change

Store-listing experiments consistently show the **first two screenshots** drive most of the
install-rate delta. Required: portrait, 1080×1920, caption burned in at the top third.

| # | Screen | Caption |
|---|---|---|
| 1 | Home with the daily pick playing | `Un clip nuevo cada día` |
| 2 | Shorts feed | `+3,000 shorts para scrollear` |
| 3 | Search with results | `Busca por invitado o episodio` |
| 4 | Mi zona with a 12-day streak | `Mantén tu racha` |
| 5 | Continue-watching rail | `Sigue donde lo dejaste` |

Ship a **dark-mode** variant of #1 — the app now supports it and it visibly differentiates the tile.

**Run this as a Play Store listing experiment**, not a blind swap: 50/50, minimum 7 days.

---

## 5. Add a 15–30s preview video

Play auto-plays the feature graphic video on the listing; App Store shows the preview inline.
Structure that works for content apps:

- 0–3s: the daily pick playing, thumb swiping — no logo, no title card
- 3–10s: shorts feed scrolling fast
- 10–20s: search, tap, instant play
- 20–30s: streak card + share to WhatsApp

**No intro animation.** The first three seconds decide it.

---

## 6. Localise to `es-PE`, `es-419` and `es-ES` — and answer every review

Two separate, cheap wins:

**Localisation.** The app targets LatAm but the listing is served from one locale. Add `es-PE`
(primary audience), `es-419` (regional Spanish) and `es-ES`. Reuse the copy above; adjust
`causa`/`pata` only in `es-PE`.

**Reviews.** Rating weighs directly on conversion, and Play surfaces developer replies. Reply to
every 1–3★ review within 48h. Prompt for the rating **after** a real value moment — a completed
episode or a 7-day streak milestone — never on launch.

---

## Measurement

Run these as **one change at a time**, 7 days minimum. Track:

| Metric | Where | Target |
|---|---|---|
| Impression → listing view | Play Console acquisition report | +15% (items 1–3) |
| Listing view → install | Play Console / Store listing experiments | +10% (items 4–5) |
| D1 / D7 / D30 retention | Analytics sink | baseline first |
| Share → install attribution | `utm_content` on the tagged store link | establish baseline |

The `utm_content` tag emitted by the in-app share loop identifies the exact clip that produced each
install — use it to decide which clips to promote, and which to feature as the daily pick.

---

## Before an iOS release

`STORE_URL_IOS` in `src/constants/env.ts` is a placeholder (`id0000000000`). Replace it with the real
App Store ID, or every share from an iOS device will point at a dead listing.
