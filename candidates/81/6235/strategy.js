/*
 * @coinsori-strategy v1
 * name: BTC Chandelier Trend SPOT 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: crypto trends persist once they start, and the previous slow EMA50/200 cross
 * missed most of the strong bull runs because it exited on every pullback. This version enters
 * fast (a quick EMA20/50 turn) and exits only when price falls a full 3.5 ATR below the highest
 * point reached since entry (a ratcheting chandelier stop). So it rides through bull pullbacks
 * but still steps away when a real reversal sets in.
 * When it buys and sells: buys when EMA20 crosses above EMA50 on closed bars; sells when price
 * closes below max(highest high since entry - 3.5*ATR14, entry - 8*ATR14). The stop only moves up.
 * When it does NOT work: in a long sideways chop with no trend, fast entries whipsaw and the fees
 * bleed the account; it also gives back a big chunk of a crash before the chandelier stop triggers,
 * so it is not a crash hedge — it is a trend rider with a wide safety net.
 */

function onUpdate(ctx) {
  const e20 = ctx.ema(20, 1);
  const e20b = ctx.ema(20, 2);
  const e50 = ctx.ema(50, 1);
  const atr = ctx.atr(14, 1);
  const pos = ctx.position || 0;
  const entry = ctx.entryPx;

  if (e20 == null || e20b == null || e50 == null || atr == null) return null;
  if (pos !== 0 && entry == null) return null;

  const stopMult = 3.5;   // chandelier distance in ATR: wide enough to survive normal bull pullbacks (~30%)
  const hardMult = 8.0;   // disaster cap from entry, so one bad call cannot ruin the account

  if (pos === 0) {
    const crossUp = e20b <= e50 && e20 > e50;
    ctx.watch([
      { side: 'buy', price: e50, trigger: 'above', note: 'EMA20 upcross EMA50' }
    ]);
    if (crossUp) return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.98 };
    return null;
  }

  // Ratchet: highest high since entry only moves up (closed bars, ago>=1).
  const prevHigh = ctx.highs.at(-2);
  let hh = ctx.state.hh || entry;
  if (prevHigh > hh) hh = prevHigh;
  ctx.state.hh = hh;

  const stop = Math.max(hh - stopMult * atr, entry - hardMult * atr);
  ctx.watch([
    { side: 'sell', price: stop, trigger: 'below', note: 'chandelier stop' }
  ]);

  if (ctx.price <= stop) {
    return { side: 'sell', qty: pos, reduceOnly: true };
  }
  return null;
}
