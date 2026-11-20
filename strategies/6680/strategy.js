/*
 * @coinsori-strategy v1
 * name: BTC FearGreed Regime Trend 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin trends for long stretches but crashes hard in fear-driven sell-offs. The Fear & Greed index z-score tells us when sentiment is unusually fearful, and the 50-day EMA tells us the trend. We only ride the trend when sentiment is not in extreme fear, so we skip the worst of the down-legs.
 * When it buys and sells: buys when the daily close is above its 50-day EMA AND the Fear & Greed z-score (vs its 90-day mean) is above -0.5; exits when the close drops below the 50-day EMA or a capped trailing stop is hit (3x ATR below the highest close since entry, never wider than 20% below it).
 * When it does NOT work: in a long sideways market the EMA crosses repeatedly and the strategy pays fees with no trend; if a crash is so fast that price gaps through the trailing stop, the ATR stop may widen during the crash so the cap (20% below the high) limits the loss instead.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const ema50_1 = ctx.ema(50, 1);
  const atr1 = ctx.atr(14, 1);
  const fg = ctx.data('fear_greed');
  if (price == null || ema50_1 == null || atr1 == null || atr1 <= 0 || fg == null) {
    ctx.watch([]);
    return null;
  }

  // Rolling Fear & Greed history for a z-score vs its own 90-day mean.
  const arr = ctx.state.fgArr || [];
  arr.push(fg);
  if (arr.length > 90) arr.shift();
  ctx.state.fgArr = arr;

  let fgZ = null;
  if (arr.length >= 30) {
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const sd = Math.sqrt(arr.reduce((a, b) => a + (b - mean) * (b - mean), 0) / arr.length);
    if (sd > 1e-9) fgZ = (fg - mean) / sd;
  }
  if (fgZ == null) {
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
    // ATR stop trails the high; capped at 20% below it so a vol spike cannot widen it into a bleed.
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

  // Flat: enter only when price trend AND sentiment are up.
  const uptrend = close1 > ema50_1;
  const notExtremeFear = fgZ > -0.5;
  ctx.watch([{ side: 'buy', price: ema50_1, trigger: 'above', note: 'long trend', conds: [{ label: 'FG z', now: fgZ, op: '>', ref: -0.5 }, { label: 'close > EMA50', ok: uptrend }] }]);
  if (allocOk && uptrend && notExtremeFear) {
    ctx.state.highSince = close1;
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  return null;
}
