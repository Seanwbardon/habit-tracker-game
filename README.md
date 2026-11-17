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

## Where to change things

| You want to change… | Edit |
|---|---|
| Stats (add, rename, remove) | `src/config/stats.ts` |
| Classes, their primary stats, suggested habits | `src/config/classes.ts` |
| Reward numbers (XP, Gold, Tokens, difficulty, the 70/30 split, encounter cap) | `src/config/rewards.ts` |
| Enemies, loot, shop prices | `src/config/enemies.ts` |
| Boss window length, boss strength, Final Boss scaling | `src/config/seasons.ts` |
| How stats turn into HP/attack/etc. | `combatantFromStats` in `src/domain/combat/engine.ts` |

## Project layout

```
src/
  config/        all tunable game data: start here
  domain/        pure game logic, no React, fully testable
    habits/      period scoring, stat suggestions
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
- **Weekly/monthly habits pay out every day** as you progress (build: that day's share of the target; limit: a share for each day still under the limit), then a completion bonus (`periodCompletionBonus`) plus the period's Tokens when it closes with the target met.
- **Daily habits pay out every day, plus a perfect-week bonus** (`perfectWeekBonusXp`) when all 7 days of a Mon–Sun week hit the target.
- **Missing a target never takes anything away.** You just don't earn that period.
- **Tokens only come from habits.** Encounters can never fund real-life rewards.
- **Daily encounter Gold is capped** at 20% of the habit Gold from the last 7 days.
- **Characters freeze** when their season ends. Skipped seasons stay empty; the Final Boss scales to however many characters you have (1–4).

## Testing seasons before they happen

The **Dev** tab can shift the game clock: jump to a boss window, the next season, or the Final Boss window, then reset. Logs made while shifted carry the shifted date, so back up first (or use a separate browser profile) if you're testing on top of real data.

## Known gaps / next steps

- Potions are in the shop and loot tables but can't be used in battle yet (add an `item` action to the combat engine).
- Bosses are a single strong enemy; add phases or special moves in `seasons/bosses.ts` + the combat engine.
- Weekly debuffs for missed habits (e.g. "Fatigued") aren't implemented.
- If you change `generateDailyEncounter`, bump `GENERATOR_VERSION`. Saved encounters store the full encounter, so they still replay exactly.
- For the 2028 release: move storage behind a sync backend (logs merge cleanly, then everything recomputes), and validate battles server-side using `replay()` if you add leaderboards.
