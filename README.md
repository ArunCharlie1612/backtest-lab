# Backtest Lab

Clean-room, bar-by-bar market **replay + journaling** platform for Forex, metals,
indices, crypto and futures. Original implementation — no third-party proprietary
code or assets. Comparable in *mechanics* to modern replay tools, built from
industry-standard financial-engineering primitives.

## Architecture

Dependencies flow inward: **domain → engine → stores → UI / API**.

```
src/
  lib/
    domain/      types, instrument specs, pip/P&L valuation
    data/        multi-timeframe aggregation, CSV ingest, sample generator
    engine/      order matching, position sizing, performance metrics
    store/       Zustand replay state machine + trading state
    hooks/       replay driver (clock → bar feed)
    api/         Zod request schemas
  components/    Chart, ReplayControls, OrderPanel, MetricsPanel, EquityCurve, TradeJournal
  app/           Next.js App Router pages + /api route handlers
prisma/          PostgreSQL schema (User, Account, Session, Trade, Tag)
```

### 1. Charting & replay engine
- Lightweight Charts candlestick surface with incremental tick updates.
- Deterministic replay state machine: play / pause / step ±1 bar / variable speed
  (0.1×–10×) / jump-to-timestamp, with a scrubber.
- Future-safe data windowing: only bars up to the replay cursor are revealed;
  higher timeframes are aggregated from the revealed 1m slice on the fly.
- Position entry / SL / TP price lines overlaid on the chart.

### 2. Paper execution engine
- Market / limit / stop entries with SL/TP brackets evaluated against bar H/L
  (pessimistic stop-first fills).
- Spread, slippage and per-lot commission modeling.
- Floating + realized P&L with instrument-accurate pip/contract valuation.
- Risk-% / fixed-cash position sizing calculator.

### 3. Analytics & journaling
- Win rate, profit factor, expectancy, average R, max drawdown ($/%), Sharpe,
  win/loss streaks.
- Equity + drawdown curve synced to closed-trade history.
- Setup/session tagging and per-trade review notes.

### 4. Data & persistence
- Prisma + PostgreSQL schema for users, accounts, sessions, trades, tags.
- Trade logging + session metrics via `/api` route handlers.
- CSV OHLCV parser and 1m→5m/15m/1h/4h/1D aggregation.

## Getting started

```bash
npm install
cp .env.example .env            # point DATABASE_URL at your Postgres/Supabase
npm run db:generate             # prisma client
npm run db:push                 # create tables (needs a reachable DB)
npm run dev                     # http://localhost:3000
```

The UI runs fully on synthetic demo data without a database. A DB is only needed
for persisting trades/sessions through the API.

## API

| Method | Route                         | Purpose                        |
| ------ | ----------------------------- | ------------------------------ |
| GET    | `/api/trades?sessionId=`      | List trades for a session      |
| POST   | `/api/trades`                 | Log a closed trade             |
| GET    | `/api/trades/:id`             | Fetch one trade                |
| PATCH  | `/api/trades/:id`             | Update notes / tags / snapshot |
| DELETE | `/api/trades/:id`             | Delete a trade                 |
| GET    | `/api/sessions?userId=`       | List sessions                  |
| POST   | `/api/sessions`               | Create a session               |
| GET    | `/api/sessions/:id/metrics`   | Computed performance report    |
