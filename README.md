# Nourish

A food and training tracker built around one idea: **you should never have to look up a number.** You type what you ate the way you would say it — `2 roti and 1 katori dal` — and what you trained the same way — `bench 3x8 60kg, running 20 min`. Portions, calories, macros, sets and burn are worked out for you. If a food or exercise is not in the database, the AI estimates it, saves it to your own list and logs it, without stopping to ask you anything.

Everyone brings their own AI key, so running this for other people costs you nothing.

Next.js 15 · React 19 · TypeScript · Prisma · SQLite · Tailwind 4

---

## Quick start

```bash
npm install
cp .env.example .env          # set AUTH_SECRET; GROQ_API_KEY is optional
npx prisma migrate deploy     # create the database
npm run db:seed               # load the 181 built-in foods
npm run dev
```

Open <http://localhost:3000>, create an account, and complete the five-step setup.

---

## What it does

### Type what you ate

Free-text entry understands quantities, fractions, household units and several foods in one line:

| You type | It logs |
| --- | --- |
| `3 roti 1 katori dal and 1 glass milk` | three entries, 678 kcal |
| `200g paneer` | Paneer, 200 g, 592 kcal |
| `half plate rice` | 125 g, 163 kcal |
| `2 cup daal` | matched past the spelling, 566 kcal |
| `½ katori rajma` | 0.5 katori, 101 kcal |

Units understood: `g`, `kg`, `ml`, `l`, `cup`, `katori`, `bowl`, `glass`, `plate`, `piece`, `slice`, `tbsp`, `tsp`, `scoop`, `handful`, `packet`, `bottle`, `can`, `peg`, plus size words (`small`, `large`) and fractions (`1/2`, `half`, `1.5`, `½`).

The built-in database has **181 foods with real Indian serving sizes** — one roti is 40 g, one katori of dal is 150 g — covering rotis, dals, sabzis, South Indian, street food, sweets, meats, dairy, packaged snacks and drinks.

### Training, in the same language

```
bench 4x8 60kg, barbell row 3x10 50kg, running 20 min
```

is three exercises, ten sets, and a calorie burn from your bodyweight and the movement's MET value. The parser understands `3x8`, `4x6 @70kg`, `135lb`, `20 min`, `5 km` and `3x60s` holds, and it will not split `Clean and Press` in half on the word "and".

**73 built-in exercises** across push, pull, legs, core, cardio, mobility and full-body, each with muscles, equipment and a MET value.

- **Routines** — save "Push A" once, log the whole session in one tap.
- **Personal bests** — best set and estimated one-rep max (Epley) per exercise.
- **Volume and split** — sets per category, volume in kg, cardio minutes, sessions per week.
- **Coach** — "what should I train today?" reads what you have trained this week *and* what you have eaten today, and tells you how to fuel the session. "Plan my training week" builds a split matched to your calorie goal, your equipment and the days you actually have.

### Training and calories, joined up

Two honest models, never both at once:

| Mode | How your target works |
| --- | --- |
| **Estimate** (default) | Your maintenance assumes an average training week, spread evenly across all seven days. |
| **Logged workouts** | The estimate is removed from the baseline, and whatever you log on Train is added to *that day's* food budget — rest days are leaner, hard sessions give you more to eat. |

Switch between them in Settings. Only one is ever counted, so training is never double counted.

### Anything unknown is added automatically

Matching is scored. Genuine matches land at 0.99–1.00; look-alikes (`misal pav` against the database's *Vada Pav*) top out near 0.57. Anything below **0.75** is not logged as a guess — it goes to the AI, which returns nutrition per 100 g and a natural serving size. That becomes one of your own foods and the entry is logged, tagged `AI`.

So `1 plate misal pav and 2 keema samosa` logs *Misal Pav* (450 kcal) and *Keema Samosa* (512 kcal) — not the wrong dish at the wrong weight. Exercises work the same way: `zercher squat` comes back classified as legs with a sensible MET value rather than being forced onto a squat variation the library happens to know.

With no API key configured the app says it does not know the food and names the closest match instead of inventing one.

### Targets that adapt

Onboarding asks for age, sex, height, weight, work type, training and daily walking. It computes BMR (Mifflin–St Jeor) and adds work, walking and training **separately** rather than hiding them in one activity multiplier, then shows the full breakdown.

Goals are capped where it matters: loss at 1% of bodyweight per week, gain at 0.5%, deficit never deeper than 25% of maintenance, with a floor of 1500 kcal (men) / 1200 kcal (women). It tells you when it has capped something and why.

---

## Home

After signing in you land on a dashboard of the whole day: calories left against a target that includes anything earned from activity, macros, steps, sleep, water, today's training, every meal at a glance, the last seven days against target, weight against your goal, patterns from the last four weeks, and your next achievements. Every tile is editable in place or one tap from the page that owns it.

## Health data from your phone and watch

**Settings → Health data** brings in steps, sleep, active and resting energy, resting heart rate, distance, weight, body fat and workouts.

**The constraint first.** Apple Health and Android's Health Connect only share data with apps *installed on the phone*. No website can read them directly, and that includes installed PWAs. So instead of Nourish reading your phone, your phone sends the data to Nourish — to a private endpoint that only accepts a personal token.

| | iPhone + Apple Watch | Android |
| --- | --- | --- |
| **Automatic** | Apple **Shortcuts** automation (free, built in), or the third-party Health Auto Export app — its JSON is recognised automatically | Any app that reads Health Connect and can send a web request |
| **Backfill** | Upload **Export All Health Data** (.zip or export.xml) | Upload a CSV |

The in-app page walks through each option with the address and token filled in.

**Push API.** `POST /api/health/ingest` with `Authorization: Bearer nsh_…`:

```json
{ "date": "2026-09-15", "steps": 9120, "activeKcal": 612, "sleep": "7 hr 12 min", "restingHeartRate": 58, "weightKg": 89.4 }
```

Numbers can arrive as text (`"12,345"`), sleep as hours, minutes, seconds or `"7 hr 12 min"`, and `{"days": [...]}` backfills several days. `GET` on the same URL checks a token. Tokens are stored only as SHA-256 hashes, shown once, and revocable one at a time.

**Getting the numbers right**

- **iPhone and Apple Watch both count the same walk.** Adding their step counts would roughly double them, so each metric takes the best single source per day, as the Health app does.
- **Sleep** counts only asleep stages (Core, Deep, REM, Asleep) — never In Bed or Awake — merges overlapping samples within a source, and belongs to the morning you wake up.
- **Units** are converted: kJ, "Cal", lb, miles, metres, and body fat given as 0.225 or 22.5.
- **Workouts** are de-duplicated by a stable id, so re-syncing or re-importing never doubles them. Energy is read from both the old (attribute) and new (`WorkoutStatistics`) export formats.
- **The export is streamed**, never loaded whole: 1.5 million records (a 250 MB export.xml) import in about 4 seconds and complete with the heap capped at 96 MB.

**Calories.** With "use logged workouts" on, a day with watch-measured active energy uses that *instead of* the step and workout estimates — active energy already contains both. Your maintenance assumes (maintenance − BMR) of activity on an average day; the difference is what the day earned or fell short. A day still in progress can only earn, never lose, because a watch at 10 am has barely started counting.

## Round three: five more

**Steps and sleep.** Log them from the dashboard. Steps are worked into calories honestly: your job multiplier already covers an ordinary day (~5,000 steps) and your walking estimate covers planned walks, so only steps beyond both count as extra — 8,000 steps with 35-minute daily walks adds nothing, 14,000 adds about 270 kcal. With "use logged workouts" on, that extra joins the day's budget. Sleep is recorded because short nights reliably push appetite up the next day.

**Body measurements.** Waist, chest, hips, arm, thigh and body fat, with a trend chart per measure. If your waist falls while your weight holds steady, Progress says so — that is recomposition, and the scale alone would hide it.

**Four-week review.** Plain arithmetic over your own log, so it works with no AI key: weekend versus weekday intake, how often you hit protein, logging coverage, late-night eating, whether training days actually get fed, how much comes from snacks and eating out, and the measured weight trend.

**Achievements.** Twelve milestones about behaviour you control — logging streaks, protein days, sessions, total volume, weigh-ins, saved meals, photo logs — and none about scale weight, which you do not. Unlocks are announced on the dashboard.

**Search.** Everything you have ever logged, food and training together, filtered by type and period and grouped by day, with totals. "When did I last have biryani?" is one query.

## Round two: the first five features beyond the basics

**1 · Adaptive maintenance.** Formulas are a guess. Once you have 4 weigh-ins and 10 logged days in a 4-week window, the app solves for what your maintenance *actually* is:

```
TDEE = average intake − (weight change in kcal ÷ days)
```

Weight is fitted by least squares so one odd weigh-in cannot swing it, and a result more than 35% away from the formula is rejected as bad data. When it succeeds, your target moves to match reality. Toggle it off on the Reports tab.

**2 · Recipes and saved meals.** Write the ingredients the same way you log food — `3 roti, 1 katori dal, 150 g curd` — name it, and it becomes one tap on the Today tab. Recipes divide by servings; saved meals log as-is. Every ingredient is logged separately, so you can still edit one.

**3 · Photo logging.** Photograph a plate, at any size. The phone shrinks it when it can, and the server always compresses it to an upright 1024 px JPEG (with sharp) before a vision model identifies each item and estimates the portion — so a 12 MB camera original is quick to process. Everything lands as normal editable entries tagged `photo`.

**4 · Eating window.** Every entry records when it was eaten, so the Today tab shows your first meal, last meal and the window between them, and Reports shows your average. Useful if you are trying to stop eating late.

**5 · Installable, and your data is yours.** A web app manifest and service worker make it installable on a phone with an offline shell. Export everything as JSON or entries as CSV, and delete your account — password-confirmed, cascading, permanent — from Settings.

Plus water tracking, a weight log that keeps targets current, quick-add for frequent foods, copy-yesterday, a logging streak, and light/dark/system themes.

---

## AI: bring your own key

Every user picks their own provider, model and key in **Settings → AI provider**. Keys are encrypted with AES-256-GCM before they are stored and are never sent back to the browser — the settings page only ever shows a mask like `gsk_ab…f9c1`. **Test connection** makes a real call, so a wrong key or an unavailable model is caught there rather than the first time someone logs an unusual food.

| Provider | Notes |
| --- | --- |
| **Groq** | Generous free tier. A good default. |
| **OpenAI** | GPT-4o / 4.1 family. |
| **Anthropic** | Claude Sonnet 5, Opus 5, Haiku 4.5. |
| **Google Gemini** | Free tier through AI Studio. |
| **OpenRouter** | One key, many models. |
| **Custom** | Any OpenAI-compatible endpoint — Ollama, LM Studio, vLLM, Together, DeepSeek. |

Anthropic is called through its Messages API; everything else speaks the OpenAI chat-completions shape, including images for photo logging.

`GROQ_API_KEY` in `.env` is now only a **shared fallback** for users who have not set their own. Leave it blank and everyone brings their own key. To check the server fallback:

```bash
npm run check:ai
```

**Model choice.** Reasoning models (`gpt-oss`, `qwen3`, `deepseek-r1`, `o`-series) spend tokens thinking before answering, which breaks OpenAI-style `json_object` mode — it sees an empty visible reply and rejects it. The app detects these, asks for JSON as plain text, parses it out itself, keeps `reasoning_effort` low and raises the token budget. Non-reasoning models use JSON mode with an automatic plain-text retry. Either kind works.

**Rate limits.** Groq's free tier budgets output tokens per minute, and asking for a `max_tokens` larger than that budget is rejected outright — so the vision call requests exactly what it needs rather than an inflated reasoning budget. Transient 429 and 5xx responses are retried with the backoff Groq asks for.

**Finding models your key can reach.** Availability varies by account:

```bash
curl -s https://api.groq.com/openai/v1/models \
  -H "Authorization: Bearer $GROQ_API_KEY" | grep '"id"'
```

Set `GROQ_MODEL` and `GROQ_VISION_MODEL` accordingly.

---

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `file:./prisma/dev.db` | SQLite file, or a Postgres URL |
| `AUTH_SECRET` | — | Signs session cookies. **Required in production** (min 32 chars) |
| `GROQ_API_KEY` | *(unset)* | Shared fallback key. Users' own keys always win |
| `GROQ_MODEL` | `openai/gpt-oss-120b` | Fallback text model |
| `GROQ_VISION_MODEL` | `qwen/qwen3.8-27b` | Fallback vision model |

## Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and serve |
| `npm test` | Food, workout and health parsing tests |
| `npm run test:workout` | Workout parser only |
| `npm run test:health` | Health data parsing and de-duplication |
| `npm run typecheck` | TypeScript, no emit |
| `npm run db:seed` | Load the built-in foods (safe to re-run) |
| `npm run db:migrate` | Create or apply migrations |
| `npm run db:studio` | Browse the database |
| `npm run check:ai` | Verify your Groq key and models |

## Deploying

1. Set `AUTH_SECRET` to a long random string (32+ characters). In production the startup check refuses to serve requests without it, with a message saying exactly what to do.
2. For anything beyond a single machine, switch `prisma/schema.prisma` to `postgresql` and point `DATABASE_URL` at your database.
3. `npx prisma migrate deploy && npm run db:seed && npm run build && npm start`.

Passwords are hashed with scrypt from the standard library; sessions are httpOnly JWT cookies signed with `AUTH_SECRET`. All data is per-user, and every mutation re-checks the session server-side.

---

## Layout

```
prisma/schema.prisma      data model
src/lib/
  health/                 phone and watch data
    types.ts              one normalised shape for every source
    formats.ts            Shortcut JSON, Health Auto Export, CSV
    apple-export.ts       streaming Apple Health export reader
    apply.ts              merge, de-duplicate and store
    tokens.ts             hashed personal sync tokens
  insights.ts             the four-week review, no AI
  achievements.ts         milestones and unlocks
  nutrition.ts            BMR, TDEE, goal maths, macro split, step burn
  parser.ts               free text -> quantity + unit + matched food
  workout-parser.ts       free text -> exercise + sets, burn, 1RM
  adaptive.ts             measured maintenance from weight trend
  tracker.ts              day summaries, the food logging pipeline
  training.ts             workouts, volume, personal bests
  ai.ts                   multi-provider client, reasoning models, retries
  providers.ts            the provider and model catalogue
  crypto.ts               API key encryption at rest
  ai-config.ts            resolves whose key a request runs on
  foods-seed.ts           the 181-food database
  exercises-seed.ts       the 73-exercise library
src/actions/              server actions (auth, log, training, profile, recipes, ai)
src/app/                  routes; (auth), (app), onboarding, api
src/components/           UI
scripts/                  seed, parser tests, AI diagnostics
```

### Adding exercises or foods to the built-in database

`src/lib/exercises-seed.ts` follows the same idea:

```ts
["Barbell Bench Press", "bench|bench press|flat bench", "push", "chest|triceps", "barbell", 0, 6]
//  name                 aliases                        category muscles        equipment isCardio MET
```

MET is the metabolic equivalent used to estimate calories from bodyweight and time.

### Adding foods to the built-in database

`src/lib/foods-seed.ts` uses one compact row per food:

```ts
["Roti / Chapati (whole wheat)", "roti|chapati|phulka", 297, 11, 58, 4, "piece:40|g:1", 1, "indian", "grain|staple"]
//  name                          aliases                kcal p   c   f   units          veg cuisine  tags
```

Macros are per 100 g; `piece:40` means one piece weighs 40 g; the first unit listed is the default. Re-run `npm run db:seed` — it updates built-in foods by name and never touches yours.

---

General guidance, not medical advice. Check with a doctor or dietitian if you have a health condition.
