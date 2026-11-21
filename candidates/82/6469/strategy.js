/*
 * @coinsori-strategy v1
 * name: BTC Dip-Buy Trend 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: BTC 4h trends are long and persistent, but the fast
 * crossover cores in this job whipsawed (EMA100) while the slow EMA50/200
 * regime held up. Buying the pullback INSIDE a confirmed uptrend, then riding
 * until the trend breaks, gets more of each move than crossover re-entry and
 * never buys into a falling market.
 * When it buys and sells: buys when price dips (RSI(14) < 35 on the closed
 * bar) while the 200-bar EMA is still up and price is above it (uptrend
 * intact). Sells when price closes below the 200-bar EMA (trend broken) or
 * falls 3x ATR below entry (hard stop).
 * When it does NOT work: in a straight-line bull with no pullbacks it stays
 * in cash and misses the rally (loses to holding); in a choppy sideways
 * market the 200-EMA whipsaws and it trades too often.
 */
function onUpdate(ctx) {
  const ema200 = ctx.ema(200, 1);
  const f = ctx.ema(50, 1);
  const atr = ctx.atr(14, 1);
  const rsi = ctx.rsi(14, 1);
  if (ema200 == null || f == null || atr == null || rsi == null) {
    ctx.watch([]);
    return null;
  }
  const price = ctx.price;
  const prevClose = ctx.closes.at(-2);
  const pos = ctx.position || 0;

  if (pos > 0) {
    const stop = (ctx.entryPx != null ? ctx.entryPx : price) - 3 * atr;
    ctx.watch([
      { side: 'sell', price: ema200, trigger: 'below', note: 'close < EMA200' },
      { side: 'sell', price: stop, trigger: 'below', note: 'ATR hard stop' }
    ]);
    if (prevClose != null && prevClose < ema200) return { side: 'sell', qty: pos, reduceOnly: true };
    if (price <= stop) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }

  // flat: uptrend = EMA50 above EMA200 and last close above EMA200
  const uptrend = f > ema200 && prevClose != null && prevClose > ema200;
  ctx.watch([{ side: 'buy', price: ema200, trigger: 'above', note: 'pullback in uptrend', conds: [
    { label: 'RSI(14) close', now: rsi, op: '<', ref: 35, closed: true },
    { label: 'EMA50>EMA200', ok: uptrend }
  ]}]);
  if (!uptrend) return null;
  if (rsi >= 35) return null;

  // risk 2% of cash per trade, stop 3x ATR away; cap at 99% cash
  const stopDist = 3 * atr;
  const riskCash = ctx.cash * 0.02;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.99) / price;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
