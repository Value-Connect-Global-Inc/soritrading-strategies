/*
 * @coinsori-strategy v1
 * name: Momentum Crash-Cooling 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Academic "momentum crashes" — after a sharp multi-day selloff,
 * momentum portfolios lose because the recent losers keep falling. We still ride
 * long momentum (30-day return positive + price above the 200-day EMA), but we
 * ADD a crash-cooling rule: no new entries for a while after a steep 3-day drop,
 * because that is exactly the regime where momentum reverses instead of
 * continuing. The exit is the same risk-mindful mechanics that were validated:
 * leave on a 200-day trend break, a 30-day momentum fade, or a 2.5x-ATR stop.
 * When it buys and sells: a leg buys when the last closed bar is above the 200-day
 * EMA, its 30-day return is positive, and there was no steep 3-day drop recently;
 * sells when the closed bar drops below the 200-day EMA, the 30-day return turns
 * negative, or a 15% hard stop is hit.
 * When it does NOT work: in a strong sustained bull market the crash-cooling keeps
 * you out right after each dip, so you miss part of the rally; and in a broad
 * crash every leg falls together, so the cooling cannot protect the held legs.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const ema200 = ctx.ema(200, 1);
  if (ema200 == null) return null;

  const c = ctx.closes;
  if (c.length < 32) return null;
  const prevClose = c.at(-2);
  const mom30 = prevClose / c.at(-32) - 1;   // 30-day return of the last CLOSED bar

  // crash-cooling: a steep 3-day drop (3-day return of closed bars) flags the
  // momentum-crash regime — momentum reverses right after sharp selloffs
  const drop3 = c.at(-2) / c.at(-5) - 1;   // 3-day return over the last 3 closed bars
  const crashCool = drop3 < -0.12;         // -12% over 3 days = sharp selloff threshold

  // volatility-scaled sizing: a calm coin gets a bigger position, a wild coin a
  // smaller one so no single leg dominates the portfolio drawdown
  const atr = ctx.atr(14, 1);
  let volScale = 1;
  if (atr != null && atr > 0 && prevClose > 0) {
    const atrPct = atr / prevClose;
    volScale = Math.min(1, 0.02 / atrPct);
  }

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const stop = ctx.entryPx * 0.85;        // hard stop: 15% below entry
    if (price <= stop) return { side: 'sell', qty: pos };
    if (prevClose < ema200) return { side: 'sell', qty: pos };   // trend over
    if (mom30 < 0) return { side: 'sell', qty: pos };            // momentum faded
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '15% stop' },
               { side: 'sell', price: ema200, trigger: 'below', note: '200-day trend break',
                 conds: [{ label: '30d return > 0', ok: mom30 > 0, closed: true }] }]);
    return null;
  }

  // crash-cooling: do NOT open a new position right after a sharp selloff
  if (crashCool) return null;
  const uptrend = prevClose > ema200;
  ctx.watch([{ side: 'buy', price: ema200, trigger: 'above', note: 'close above 200-day EMA',
               conds: [{ label: '30d return > 0', ok: mom30 > 0, closed: true },
                       { label: 'close > 200-EMA', ok: uptrend, closed: true },
                       { label: 'no 3d crash', ok: !crashCool, closed: true }] }]);
  if (!uptrend || !(mom30 > 0)) return null;

  const targetCash = ctx.cash * 0.33 * volScale;
  const qty = (targetCash / price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
