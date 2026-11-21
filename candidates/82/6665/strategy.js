/*
 * @coinsori-strategy v1
 * name: BNB 1D NDX Risk-On Regime (spot)
 * ex: binance
 * syms: BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Generalization test #2 of the NASDAQ risk-on gate that
 * validated on BTC (6661) and ETH (6663) but failed on high-beta SOL (6664).
 * BNB is a large-cap alt like BTC/ETH, so this maps whether the edge is
 * "large caps yes, high-beta no" or "BTC/ETH only". Same code, no tuning.
 * When it buys and sells: buys when BNB closes above its 50-day EMA AND the
 * NASDAQ z-score is above -0.5 (risk-on). Exits on EMA50 break or capped
 * trailing stop.
 * When it does NOT work: crypto-only rallies equities do not confirm; choppy
 * EMA whipsaw; 2-day NDX lag on sudden crashes.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const ema50_1 = ctx.ema(50, 1);
  const atr1 = ctx.atr(14, 1);
  const ndx = ctx.data('base_ndx');
  if (price == null || ema50_1 == null || atr1 == null || atr1 <= 0 || ndx == null) {
    ctx.watch([]);
    return null;
  }
  const arr = ctx.state.ndxArr || [];
  arr.push(ndx);
  if (arr.length > 200) arr.shift();
  ctx.state.ndxArr = arr;
  let ndxZ = null;
  if (arr.length >= 60) {
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const sd = Math.sqrt(arr.reduce((a, b) => a + (b - mean) * (b - mean), 0) / arr.length);
    if (sd > 1e-9) ndxZ = (ndx - mean) / sd;
  }
  if (ndxZ == null) {
    ctx.watch([]);
    return null;
  }
  const close1 = ctx.closes.at(-2);
  if (close1 == null) {
    ctx.watch([]);
    return null;
  }
  const pos = ctx.position;
  const allocOk = !ctx.alloc || ctx.alloc.status === 'ok';
  if (pos > 0) {
    const highSince = ctx.state.highSince || close1;
    const newHigh = Math.max(highSince, close1);
    ctx.state.highSince = newHigh;
    const stop = Math.max(newHigh - 3 * atr1, newHigh * 0.80);
    const trendBroken = close1 < ema50_1;
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: 'trailing stop' },
               { side: 'sell', price: ema50_1, trigger: 'below', note: 'EMA50 break' }]);
    if (close1 < stop || trendBroken) {
      ctx.state.highSince = 0;
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }
  const uptrend = close1 > ema50_1;
  const riskOn = ndxZ > -0.5;
  ctx.watch([{ side: 'buy', price: ema50_1, trigger: 'above', note: 'long risk-on', conds: [{ label: 'NDX z', now: ndxZ, op: '>', ref: -0.5 }, { label: 'close > EMA50', ok: uptrend }] }]);
  if (allocOk && uptrend && riskOn) {
    ctx.state.highSince = close1;
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  return null;
}
