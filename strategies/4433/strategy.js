/*
 * @coinsori-strategy v1
 * name: Donchian Breakout BTC 1D (turtle)
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin's biggest rallies historically start with a
 * decisive break above a multi-month high — the moment buyers overwhelm the
 * supply trapped above the previous range. A Donchian channel (highest high /
 * lowest low of the last N days) turns that observation into a rule: a close
 * above the 55-day high is the buy signal, a close below the 20-day low is the
 * exit. This is the classic "turtle" breakout system, a different family from
 * moving-average trend following.
 * When it buys and sells: buys when the previous close breaks above the highest
 * high of the 55 days BEFORE it. Sells when price closes below the lowest low
 * of the 20 days before it, or a 2.5x ATR hard stop is hit. Positions are
 * sized so each trade risks 4% of cash.
 * When it does NOT work: in a long, quiet range (no new 55-day highs for
 * months) it sits in cash and earns nothing; and in a choppy market every
 * breakout is immediately reversed, so it buys high and stops out repeatedly.
 * It is momentum, not mean-reversion — it loses when a market grinds sideways.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0) return null;

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const stop = ctx.entryPx - 2.5 * atr;   // hard stop: 2.5x daily ATR below entry
    if (price <= stop) return { side: 'sell', qty: pos };
    const low20 = ctx.low(20, 2);           // lowest low of the 20 CLOSED bars BEFORE the previous close
    const prevClose = ctx.closes.at(-2);
    if (low20 == null || prevClose == null) return null;
    if (prevClose < low20) return { side: 'sell', qty: pos };   // 20-day low break = trend over
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '2.5x ATR stop' },
               { side: 'sell', price: low20, trigger: 'below', note: '20-day low break' }]);
    return null;
  }

  const high55 = ctx.high(55, 2);           // highest high of the 55 CLOSED bars BEFORE the previous close
  const prevClose = ctx.closes.at(-2);
  if (high55 == null || prevClose == null) return null;
  const breakout = prevClose > high55;   // close above 55-day high = entry
  ctx.watch([{ side: 'buy', price: high55, trigger: 'above', note: '55-day high breakout',
               conds: [{ label: 'close > 55d high', ok: breakout, closed: true }] }]);
  if (!breakout) return null;

  const riskCash = ctx.cash * 0.04;         // risk 4% of cash per trade
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash / price) * 0.95;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
