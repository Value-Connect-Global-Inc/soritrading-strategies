/*
 * @coinsori-strategy v1
 * name: BTC Trend Long-Short SMA200 4H USDM
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: On BTC perpetual futures, strong trends persist — riding them in BOTH
 * directions (long in up-trends, short in down-trends) lets falling markets earn instead of
 * sitting flat, which is where a long-only spot strategy loses to holding.
 * When it buys and sells: buys when price is above a rising 200-SMA, sells (shorts) when price
 * is below a falling 200-SMA. Every position carries a hard stop at 3x ATR from entry.
 * When it does NOT work: choppy sideways markets where price whipsaws around the SMA produce
 * repeated small losses; the slow 200-SMA filter gives back gains on sharp V-reversals before
 * it flips. Funding costs on the perpetual add up when the position is held against the funding
 * direction.
 */
function onUpdate(ctx) {
  const s = ctx.sma(200, 1);
  const sPrev = ctx.sma(200, 2);
  const atr = ctx.atr(14, 1);
  if (s == null || sPrev == null || atr == null) return null;

  const price = ctx.price;
  const pos = ctx.position;          // negative = short on usdm
  const entry = ctx.entryPx;         // null when flat

  const trendUp = price > s && s > sPrev;
  const trendDown = price < s && s < sPrev;

  // risk sizing: 60% of equity as notional, one direction at a time (modest, cannot ruin account)
  const qty = (ctx.cash * 0.6) / price;

  const mult = 3; // stop distance in ATR units — wide enough to survive noise, tight enough to cap loss

  // --- in a long position ---
  if (pos > 0) {
    if (entry == null) return null;
    const stop = entry - mult * atr;
    if (trendDown || price <= stop) {
      ctx.watch([{ side: 'sell', price: Math.min(s, stop), trigger: 'below', note: 'close long' }]);
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    ctx.watch([
      { side: 'sell', price: stop, trigger: 'below', note: 'long stop' },
      { side: 'sell', price: s, trigger: 'below', note: 'trend flip' }
    ]);
    return null;
  }

  // --- in a short position ---
  if (pos < 0) {
    if (entry == null) return null;
    const stop = entry + mult * atr;
    if (trendUp || price >= stop) {
      ctx.watch([{ side: 'buy', price: Math.max(s, stop), trigger: 'above', note: 'close short' }]);
      return { side: 'buy', qty: -pos, reduceOnly: true };
    }
    ctx.watch([
      { side: 'buy', price: stop, trigger: 'above', note: 'short stop' },
      { side: 'buy', price: s, trigger: 'above', note: 'trend flip' }
    ]);
    return null;
  }

  // --- flat ---
  if (trendUp) {
    ctx.watch([{ side: 'buy', price: s, trigger: 'above', note: 'SMA200 up', conds: [{ label: 'SMA200 rising', ok: true }] }]);
    return { side: 'buy', qty: qty };
  }
  if (trendDown) {
    ctx.watch([{ side: 'sell', price: s, trigger: 'below', note: 'SMA200 down', conds: [{ label: 'SMA200 falling', ok: true }] }]);
    return { side: 'sell', qty: qty };
  }
  ctx.watch([]);
  return null;
}
