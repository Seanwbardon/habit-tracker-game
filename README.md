# Habit Quest

A JRPG-style habit tracker. Your real habits level up a character, earn Gold (in-game) and Tokens (real-life rewards), and power a short daily battle. Seasons follow the calendar (Jan–Mar, Apr–Jun, Jul–Sep, Oct–Dec), each with a boss in its last 7 days, and a scalable Final Boss at the end of the year.

## Getting started

Needs Node 22.18 or newer.

```bash
npm install
npm run dev        # open the URL it prints
npm test           # rules-engine tests (Node's built-in runner)
npm run typecheck
npm run build      # static site in dist/, can be hosted anywhere
```

Data is saved in your browser (localStorage). Use **Dev → Export backup** regularly.

## How it fits together

```
Habit logs ──► rules engine ──► XP, Gold, Tokens ──► character stats
   (stored)        (derived, recomputed on every load)
                                       │
               daily encounters + bosses (small, capped Gold)
```

Only **habits, logs, characters, and non-habit ledger entries** (shop, redemptions, encounter Gold) are stored. XP, stats, and habit income are always recomputed from logs, so changing a reward number rebalances everything automatically.

Every rules-engine call goes through `rewardLogs(data)` in `game.ts`. It drops excluded test logs and assigns each log to the right version of an edited habit (see below), so the UI and the engine always agree on what counts.

## Where to change things

| You want to change… | Edit |
|---|---|
| Stats (add, rename, remove) | `src/config/stats.ts` |
| Classes, their primary stats, suggested habits | `src/config/classes.ts` |
| Reward numbers (XP, Gold, Tokens, difficulty, the 70/30 split, encounter cap) | `src/config/rewards.ts` |
| Enemies, loot, shop prices | `src/config/enemies.ts` |
| Boss window length, boss strength, Final Boss scaling | `src/config/seasons.ts` |
| How stats turn into HP/attack/etc. | `combatantFromStats` in `src/domain/combat/engine.ts` |
| Chart data (history, streaks, heatmap, progress) | `src/domain/habits/history.ts` |
| Chart drawing (bars, lines, heatmap, colours) | `src/ui/components/charts/` + the chart block in `src/ui/styles.css` |

## Project layout

```
src/
  config/        all tunable game data: start here
  domain/        pure game logic, no React, fully testable
    habits/      period scoring, stat suggestions, edit chains, chart data
    rules/       period results → XP / Gold / Tokens
    economy/     ledger, balances, encounter Gold cap
    character/   stat derivation, snapshots
    encounters/  seeded RNG, daily encounter generator
    combat/      pure turn-based engine: step(state, action) → state
    seasons/     calendar, boss window, season + Final Boss
    clock.ts     the only "now"; has a dev offset for testing
    game.ts      facade the UI calls
  data/          localStorage persistence + backup/restore
  ui/            React screens and components
tests/           node:test suites
```

## Rules worth knowing

- **Rewards land when a period closes** (end of day/week/month), not when you log. Progress shows live.
- **Weekly/monthly build habits pay out every day** as you progress (that day's share of the target), then a completion bonus (`periodCompletionBonus`) plus the period's Tokens when it closes with the target met.
- **Weekly/monthly limit habits pay when the period closes**, and only if it closed at or under the limit: a share for each *clean* day (nothing logged), the headroom bonus, the completion bonus and the Tokens. Days with something logged earn nothing, and going over the limit earns nothing for that period. Nothing is paid mid-period, so nothing ever has to be taken back.
- **Daily habits pay out every day, plus a perfect-week bonus** (`perfectWeekBonusXp`) when all 7 days of a Mon–Sun week hit the target.
- **Missing a target never takes anything away.** You just don't earn that period.
- **Tokens only come from habits.** Encounters can never fund real-life rewards.
- **Daily encounter Gold is capped** at 20% of the habit Gold from the last 7 days.
- **Characters freeze** when their season ends. Skipped seasons stay empty; the Final Boss scales to however many characters you have (1–4).

## Tracking habits

- **Log a past day.** Each habit card has a date picker next to **Log** (defaults to today, no future dates). If the date falls in a period that has already closed, a note says so: that period's rewards are recalculated from the logs, as everything is.
- **Details.** Click a habit's name for its detail view: a calendar heatmap of the year (missed days of daily habits are outlined), the full-width history chart, completion rate / average / best period / total, and every log with a delete button.
- **Card chart.** Toggle 8 periods / this season / this year. The open period is striped (not scored yet), missed periods are hatched with an outline, and limit habits shade the "over limit" zone. Current and best streak (consecutive periods with the target met) sit above it.
- **Progress tab.** Cumulative stat XP by week (your class's stats are thick and labelled), Gold and Tokens balance over the season with ▼ on spending days, and the share of habit periods met each week. Pick any season, including archived ones.

### Edits apply from now on

Renaming a habit updates it in place. Changing anything that affects rewards (type, target, unit, period, stats, difficulty) never rewrites history:

- The old habit is archived at a cutoff and a new habit linked by `previousHabitId` takes over. Charts, streaks, the detail view and Delete treat the chain as one habit.
- The cutoff is the latest of: the start of the current period under the old settings, the start of the current period under the new settings, and the old version's creation. **Closed periods keep exactly the rewards they earned**; the current open period is scored under the new settings.
- Logs keep their stored `habitId`; `attributeLogs()` in `domain/habits/chain.ts` gives each version the logs in its time window. When the period gets longer (daily → weekly), logs from earlier in the new week still count toward its target, but aren't paid again as daily progress.
- Editing again before the new version has earned anything just updates it in place.

### Balances below zero

Changing reward numbers can leave you having spent more than your habits now earn. The ledger isn't touched: balances are shown as 0 and purchases stay locked until you've earned it back.

## Testing seasons before they happen

The **Dev** tab can shift the game clock: jump to a boss window, the next season, or the Final Boss window, then reset.

Logs made through the UI while the clock is shifted are saved with `test: true` and show a **test** badge in the habit's log list. By default (Dev → *Leave test logs out of rewards while the clock is real*) they don't count toward rewards while the clock is real, and they do count while it's shifted, so boss testing still works. **Delete all test logs** removes them and leaves real logs alone.

## Known gaps / next steps

- Potions are in the shop and loot tables but can't be used in battle yet (add an `item` action to the combat engine).
- Bosses are a single strong enemy; add phases or special moves in `seasons/bosses.ts` + the combat engine.
- Weekly debuffs for missed habits (e.g. "Fatigued") aren't implemented.
- If you change `generateDailyEncounter`, bump `GENERATOR_VERSION`. Saved encounters store the full encounter, so they still replay exactly.
- For the 2028 release: move storage behind a sync backend (logs merge cleanly, then everything recomputes), and validate battles server-side using `replay()` if you add leaderboards.
