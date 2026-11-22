/*
 * @coinsori-strategy v1
 * name: ETH 4H Trend Regime ATR
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Crypto 4h trends persist for days, so riding them with a trailing stop captures the move while a 200-EMA regime filter keeps us out of bear phases.
 * When it buys and sells: Buys when the 20-EMA crosses above the 50-EMA while price is above the 200-EMA; sells when price falls 3×ATR below its best level (trailing stop).
 * When it does NOT work: In flat sideways markets EMA crosses whipsaw and fees pile up; a sudden crash can gap through the stop.
 */

function onUpdate(ctx) {
  const f1 = ctx.ema(20, 1);
  const f2 = ctx.ema(20, 2);
  const s1 = ctx.ema(50, 1);
  const s2 = ctx.ema(50, 2);
  const regime = ctx.ema(200, 1);
  const atr = ctx.atr(14, 1);
  if (f1 == null || f2 == null || s1 == null || s2 == null || regime == null || atr == null) {
    ctx.watch([]);
    return null;
  }

  const px = ctx.price;
  const pos = ctx.position;

  // Trailing stop: ratchet up with the best price, 3 ATR behind
  let trail = ctx.state.trail;
  if (pos > 0) {
    const cand = px - atr * 3.0;
    trail = (trail == null) ? cand : Math.max(trail, cand);
  } else {
    trail = null;
  }
  ctx.state.trail = trail;

  // Exit long when the trailing stop is hit
  if (pos > 0) {
    ctx.watch([{ side: 'sell', price: trail, trigger: 'below', note: 'ATR trailing stop' }]);
    if (px <= trail) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  // Entry: fresh 20/50 EMA cross up while price is above the 200-EMA regime
  if (pos === 0) {
    const crossUp = f2 <= s2 && f1 > s1;
    if (crossUp && px > regime) {
      const maxQty = (ctx.cash / px) * 0.99;
      // size so a full 3-ATR stop costs ~1% of cash, capped at 99% of cash notional
      const qty = Math.min((ctx.cash * 0.01) / (atr * 3.0), maxQty);
      ctx.watch([{
        side: 'buy',
        price: regime,
        trigger: 'above',
        note: 'regime + EMA cross',
        conds: [{ label: 'EMA20>EMA50', ok: f1 > s1 }]
      }]);
      return { side: 'buy', qty: qty };
    }
    ctx.watch([{ side: 'buy', price: regime, trigger: 'above', note: 'regime + EMA cross' }]);
    return null;
  }

  ctx.watch([]);
  return null;
}
