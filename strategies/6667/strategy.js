/*
 * @coinsori-strategy v1
 * name: BTC 1D FearGreed Regime Gate (spot)
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The NASDAQ risk-on gate validated on BTC 1d (6661) but
 * only uses equity sentiment. This strategy swaps the gate for a crypto-native
 * sentiment gauge, the Fear & Greed index, as a z-score vs its own mean. It is
 * a DIFFERENT data axis (crypto sentiment vs equity index) and may catch
 * crypto-only rallies that equities do not confirm. Same protective exit
 * structure (EMA50 trend + capped trailing stop) that validated on BTC/ETH.
 * When it buys and sells: buys when BTC closes above its 50-day EMA AND the
 * Fear & Greed z-score is above -0.5 (crypto risk-on). Exits when BTC closes
 * below the 50-day EMA or a capped trailing stop is hit.
 * When it does NOT work: in a choppy market it whipsaws around the EMA and
 * pays fees; the sentiment index can lag a fast crash; greed staying elevated
 * while price falls can cause early entries in a bear.
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
  // ctx.data gives one value per bar, so we keep our own series in ctx.state.
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
    // Cap the ATR stop at 20% below the high so a vol spike cannot widen it.
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

  // Flat: enter only when the price trend AND crypto sentiment are up.
  const uptrend = close1 > ema50_1;
  const riskOn = fgZ > -0.5;
  ctx.watch([{ side: 'buy', price: ema50_1, trigger: 'above', note: 'long risk-on', conds: [{ label: 'FG z', now: fgZ, op: '>', ref: -0.5 }, { label: 'close > EMA50', ok: uptrend }] }]);
  if (allocOk && uptrend && riskOn) {
    ctx.state.highSince = close1;
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  return null;
}
