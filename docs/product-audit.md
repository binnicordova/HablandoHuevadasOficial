# Hablando Huevadas — Product & Growth Audit

**Scope:** `src/`, `assets/data/data.json`, `app.config.ts` · Expo SDK 57.0.15 · React Native 0.86
**Goal under review:** increase DAU and 30-day retention
**Dataset:** 535 full episodes + 3,121 shorts (3.3 MB bundled JSON)

---

## 0. Headline

The content is strong. The product around it was not.

Before this pass, the app was a thin YouTube wrapper with **three interruptions stacked in front of the
first video**: a hardcoded 3-second fake loading delay, a full-screen share modal on every launch, and an
OS push-permission dialog fired from module scope before a single frame rendered. Time from tap to
playable content was over five seconds and three taps — for content the user can reach in one tap
inside YouTube.

There was no reason to keep the app installed: no search across 3,656 items, no favourites, no history,
no resume, no offline story, no reason to open it tomorrow rather than today.

All of that is now implemented. What is *not* implemented, and why, is listed in §5.

---

## 1. Value Proposition & Core Loop

### 1.1 Is the core hook strong enough for habitual use?

**No — as it stood.** The app offered a strictly worse version of YouTube: the same clips, fewer
features, one extra install. A soundboard, tour info and community content were part of the intended
positioning but **did not exist in the codebase**.

The hook is now: *the app knows what you already watched, remembers where you stopped, and gives you
one specific clip per day that everyone else is also getting today.* That last part is the only piece
YouTube structurally cannot copy for this audience — a shared daily artefact is what makes "¿viste la
huevada de hoy?" a real conversation.

### 1.2 Friction inside the first 30 seconds — what was actually there

Each of these is a real defect found in the code, not a hypothesis.

| # | Friction | Location | Cost | Status |
|---|---|---|---|---|
| 1 | `setTimeout(…, 3000)` faked a network delay on a **bundled** dataset | `services/service.ts` | 3s of dead time before first paint | **Fixed** — resolves on the same tick |
| 2 | `PromoModal` mounted with `useState(true)` — full-screen share ask on **every** cold start | `app/index.tsx` | Blocked the core action every session | **Fixed** — gated behind ≥4 sessions, ≥3 plays, 7-day cooldown |
| 3 | `initNotification()` ran at module import, firing the OS permission dialog before any content | `AppEntry.tsx` | Permanent denial from users who saw no value yet | **Fixed** — inline opt-in card after ≥2 sessions and ≥1 play |
| 4 | On denial, an `Alert` pushed users into system settings | `hooks/useNotification.ts` | Hostile first-run | **Fixed** — only shown if the user explicitly opted in and was blocked |
| 5 | Full 3.3 MB catalog serialised into AsyncStorage on every launch via `atomWithStorage` | `stores/store.ts` | JS-thread stall; near Android's ~6 MB AsyncStorage ceiling | **Fixed** — catalog is in-memory only; storage holds ~2 KB of user state |
| 6 | No search across 3,656 items | — | Only discovery path was scrolling a flat list | **Fixed** — indexed, accent-insensitive search |
| 7 | `router.push("shorts")` used a relative href | `app/index.tsx` | Fragile navigation | **Fixed** — typed `PATHS` constants |
| 8 | Notification deep link targeted `/web`, **which did not exist** | `constants/routes.ts` | Tapping a notification crashed | **Fixed** — `app/web.tsx` added, https-only |
| 9 | `@expo/vector-icons` and `@react-navigation/native` imported but **not installed** | `AppBar.tsx`, `Icon.tsx` | Unresolvable modules | **Fixed** — vector-icons installed, navigation replaced with expo-router |
| 10 | Daily background task shipped `"Hello There! This is a test notification."` | `tasks/index.ts` | Test copy reaching production users | **Fixed** — refreshes the real daily digest |
| 11 | `theme()` hardcoded light despite `userInterfaceStyle: "automatic"` | `theme/colors.ts` | No dark mode | **Fixed** — `useTheme()` follows the system |
| 12 | Thumbnails used signed `?sqp=` URLs that expire | dataset | Grey boxes after a dataset refresh | **Fixed** — rebuilt from video id |

**Result:** the pick of the day is mounted and playable on the first frame. Zero taps, zero modals,
zero permission dialogs.

### 1.3 Five features that turn passive consumers into daily actives — all implemented

1. **Huevada del día** — one deterministic clip per calendar day, identical on every device
   (`hashString(dayKey())`). Creates a shared daily artefact and a reason to return *today*.
2. **Seguir viendo** — playback position is polled every 5s and persisted; a rail on Home resumes
   any half-watched episode. Episodes run up to 1h17m, so resume is the difference between
   finishing and abandoning.
3. **Racha (streak)** — consecutive-day counter with milestones at 3/7/14/30/60/100 and a
   share-your-streak action. Loss aversion, and it costs one badge of UI.
4. **Buscar** — token-AND search over a pre-normalised index of all 3,656 items, accent- and
   case-insensitive, with filters and recent searches.
5. **Favoritos** — one-tap heart on every card, collected in *Mi zona*.

---

## 2. Engagement & Retention Engine

### 2.1 Local notifications — the whole strategy, no server required

Deliberately **local-only**. Expo Go dropped remote push on Android in SDK 53, and remote push would
require a backend the app does not have. Three scheduled notifications cover the retention curve:

| Trigger | Timing | Purpose |
|---|---|---|
| **Huevada del día** | `DAILY` at a user-chosen hour (default 19:00) | The habit anchor. Body names the actual clip. |
| **Streak reminder** | `TIME_INTERVAL` 20h, re-armed each launch, only if streak ≥ 2 | Only ever reaches users who stopped coming back. |
| **Win-back** | `TIME_INTERVAL` 72h, re-armed each launch | Day-3 churn intercept. |

Because the rolling reminders are rescheduled on every launch, an active user never receives them —
they only fire in the gap the user actually left.

**Permission timing is the whole game.** The prompt now appears as an inline card in the feed after
≥2 sessions and ≥1 completed play. Never a modal, never on first run.

### 2.2 Offline

The catalog ships **inside the bundle**, so browsing, search, favourites and history work with no
network at all. Thumbnails use `expo-image` with `cachePolicy: "disk"`. Only YouTube playback needs a
connection — which is the honest limit of an embedded-player app.

### 2.3 Gamification and community without UI bloat

Everything added occupies existing surface area:

- The streak is a **pill in the header** (one icon + one number) and a card in *Mi zona*. No new tab.
- Favourites are a **heart already inside each card**. No new tab.
- Milestones surface as progress inside the existing streak card, not as a separate achievements screen.

The one genuinely new surface is the fourth tab (*Mi zona*), which absorbs favourites, history, streak
and settings — four features, one tab.

**UGC is not implemented, and should not be yet.** See §5.

---

## 3. Organic Acquisition & Growth Loops

### 3.1 Native shareability

Sharing is now a first-class action on every surface — home player, shorts overlay, detail page — via
`ShareBar`, with three paths:

- **WhatsApp direct** (`whatsapp://send`) — the dominant sharing channel in LatAm, and one tap fewer
  than the OS sheet. Falls back to the system sheet when WhatsApp is absent.
- **System share sheet** — TikTok, Instagram, Telegram, SMS.
- **Copy link** — with confirmation state.

Every share payload contains the **playable YouTube link** (so it works for someone without the app)
**plus a tagged store link**:

```
utm_source=app_share&utm_medium=<surface>&utm_content=<videoId>
```

carried in Play Store `referrer` on Android and the query string on iOS. That closes the loop: you can
see *which clip* drives installs, not just that shares happen.

Shared clips open into `app/video/[id]`, a deep-linkable screen that starts playing immediately —
the landing experience that makes a share convert. Android `intentFilters` with `autoVerify` are
configured for `hablandohuevadasoficial.com`.

**Streak sharing** ("Llevo N días seguidos…") gives a second, content-independent share trigger.

### 3.2 The one gap in the viral loop

Shares carry a *link*, not a *video file*. The highest-yield loop for this content is a rendered
clip — watermarked, 9:16, ready to drop into a Story or a TikTok. That needs server-side rendering
(the app only embeds a YouTube iframe; it has no access to the video bitstream). It is the single
highest-impact growth item not built here, and it is listed as a Strategic Bet in §4.

### 3.3 ASO & CRO

Six prioritised quick wins with ready-to-paste copy: **[`docs/aso-cro.md`](./aso-cro.md)**.
These are store-console changes and cannot be made from the codebase.

---

## 4. Impact vs. Effort

### Quick Wins — high impact, low effort · **all implemented**

| Item | Why it matters |
|---|---|
| Remove the 3s fake delay | Pure loss, zero benefit |
| Stop persisting 3.3 MB to AsyncStorage | JS-thread stall + Android storage-limit risk |
| Gate the promo modal | It blocked the core action on every launch |
| Move the permission ask after first value | Recovers users who would have permanently denied |
| Autoplay the daily pick | Zero taps to core action |
| Search | Only discovery path for 3,656 items |
| Favourites + history + resume | Turns a feed into a library |
| Share on every surface, WhatsApp-first | The acquisition loop |
| Fix the crashing `/web` deep link | Every notification tap hit it |
| Replace the test notification copy | Production users were receiving it |
| Dark mode | Config already promised it |
| Rebuild thumbnails from video id | Signed URLs expire |

### Strategic Bets — high impact, high effort · **not implemented**

| Item | Why it's worth it | Why it's not here |
|---|---|---|
| **Server-rendered shareable clips** (watermarked 9:16 MP4) | The real viral loop; a link share is 5–10× weaker than a video share | Needs backend video pipeline; the app only embeds an iframe |
| **Comments / reactions per clip** | The "community" half of the positioning | Needs a backend, moderation, and abuse handling — see §5 |
| **Real remote push** (`expo-notifications` + a scheduler) | Lets you push *breaking* content, not just a daily local timer | Needs a server; also unavailable in Expo Go on Android |
| **Soundboard** | Genuinely differentiated, highly shareable, offline | Needs licensed audio assets that aren't in the repo |
| **Tour / ticketing integration** | Direct revenue, high intent | Needs a data source and a commercial partner |

### Fill-ins — lower impact, low effort

- Haptics on core actions · **implemented**
- Skeleton/shimmer states matched to the real layout · **implemented**
- `+not-found` route · **implemented**
- Analytics event seam (`services/analytics.ts`) · **implemented, sink not connected**
- Reminder-hour picker · **implemented**

### Pass — do not build

- **Login / accounts.** Nothing in the product needs identity. It would add the single biggest
  drop-off point in the funnel for zero user benefit.
- **In-app video downloads.** YouTube ToS.
- **Onboarding carousel.** The content *is* the onboarding; a carousel would reintroduce exactly the
  friction this pass removed.
- **A separate "Categorías" tab.** Search plus the filter chips already cover it, and a fifth tab
  would dilute the four that matter.

---

## 5. What was deliberately not built

Stating these plainly rather than shipping half-versions:

1. **User-generated content and community features.** Real UGC needs a backend, identity, moderation
   tooling, and a reporting flow. A comments feature on a Peruvian comedy app without moderation is a
   liability, not a growth lever. The right sequence is: measure whether share-driven installs convert
   (now instrumented) → add a read-only reactions layer → only then open text input.
2. **ASO listing changes.** Copy and asset specs are in `docs/aso-cro.md`, but screenshots, title and
   description live in Play Console / App Store Connect.
3. **A connected analytics provider.** `services/analytics.ts` buffers typed events and exposes
   `setAnalyticsSink()`. Choosing a vendor is a data-residency and cost decision, so no SDK was added.
   Nothing leaves the device until a sink is installed.
4. **The iOS store URL is a placeholder** (`id0000000000` in `constants/env.ts`) — it needs the real
   App Store ID before an iOS release, or every iOS share will point nowhere.

---

## 6. Verification

| Check | Result |
|---|---|
| `tsc --noEmit` | 0 errors |
| `jest` | 42 tests, 11 suites, all passing |
| `biome ci .` | clean |
| `expo export --platform android` | exit 0 |
| Expo Go compatibility | native-only modules guarded at runtime |

### Expo SDK 57 / Expo Go compliance

- `expo-av` (deprecated, removed in SDK 55) — **removed**; it was an unused dependency.
- `@react-navigation/native` — **removed**; all navigation is expo-router (`Stack`, `Tabs`,
  `useLocalSearchParams`, `router`).
- `expo-background-task` — **guarded** behind an Expo Go check; the daily digest is a local `DAILY`
  trigger and does not depend on it.
- `getExpoPushTokenAsync` — **removed** from the startup path; remote push is unavailable in Expo Go
  on Android and the app needs no server.
- Unused non-Expo packages `react-native-linear-gradient` and `react-native-deck-swiper` — **removed**.
- Added: `expo-image`, `expo-haptics`, `expo-clipboard`, `@expo/vector-icons` — all Expo Go compatible.
