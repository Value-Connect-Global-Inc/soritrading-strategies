/*
 * @strategy v1
 * name: FearGreed Contrarian BTC 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Crypto sentiment swings to extremes and mean-reverts.
 * Extreme fear (index < 25) historically marks panic bottoms, and extreme
 * greed (index > 65) marks euphoria tops. Buying the panic and selling into
 * the euphoria captures the swing back to normal sentiment.
 * When it buys and sells: buys BTC when the Fear & Greed index is below 25
 * (panic) AND price has already dropped at least 15% over the last 30 days
 * (a real crash, not a mild dip); sells when the index rises above 65 (greed)
 * or a 15% hard stop is hit.
 * When it does NOT work: in a slow grinding decline the index stays in fear
 * but price keeps falling slowly — the 30-day drop filter may not fire and
 * positions get stopped out repeatedly. And if a panic is followed by more
 * panic, buying early loses. It also sits in cash for long calm periods.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const fg = ctx.data('fg');               // Crypto Fear & Greed, 0-100
  if (fg == null) return null;

  const c = ctx.closes;
  if (c.length < 32) return null;
  const prevClose = c.at(-2);
  const mom30 = prevClose / c.at(-32) - 1; // 30-day return of last CLOSED bar

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const stop = ctx.entryPx * 0.85;       // hard stop: 15% below entry
    if (price <= stop) return { side: 'sell', qty: pos };
    if (fg > 65) return { side: 'sell', qty: pos };   // greed = take profit
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '15% stop' },
               { side: 'sell', price: 65, trigger: 'above', note: 'FG > 65 greed',
                 conds: [{ label: 'FG index', now: fg, op: '>', ref: 65, closed: true }] }]);
    return null;
  }

  const crashLevel = c.at(-32) * 0.85;      // price that means "30d drop > 15%"
  const crash = mom30 < -0.15;             // real crash, not a mild dip
  ctx.watch([{ side: 'buy', price: crashLevel, trigger: 'below', note: '30d drop > 15%',
               conds: [{ label: 'FG index', now: fg, op: '<', ref: 25, closed: true }] }]);
  if (!(fg < 25) || !crash) return null;

  const qty = (ctx.cash / price) * 0.95;   // full pool on one coin
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
