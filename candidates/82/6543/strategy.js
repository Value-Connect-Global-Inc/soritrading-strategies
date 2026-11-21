/*
 * @coinsori-strategy v1
 * name: BTC Long-Short Trend 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: BTC trends persist for weeks. A trend-following strategy on a perpetual can go BOTH ways — long when the trend is up, short when it is down — so it keeps making money in falling markets where a long-only buy-and-hold loses.
 * When it buys and sells: goes long when the 50-bar EMA is above the 200-bar EMA and rising; goes short when it is below and falling; steps to cash when the two cross without a confirmed direction. A 3x ATR stop caps every position.
 * When it does NOT work: in a choppy sideways market the EMA cross whipsaws long/short and pays fees and funding on both sides — this loses to holding in flat regimes.
 */
function onUpdate(ctx) {
  const emaFast = ctx.ema(50, 1);
  const emaSlow = ctx.ema(200, 1);
  const emaFastPrev = ctx.ema(50, 2);
  const atr = ctx.atr(14, 1);
  if (emaFast == null || emaSlow == null || emaFastPrev == null || atr == null) return null;

  const pos = ctx.position || 0;
  const bull = emaFast > emaSlow;
  const rising = emaFast > emaFastPrev;

  let stop = null;
  if (pos !== 0 && ctx.entryPx != null) stop = ctx.entryPx - Math.sign(pos) * 3 * atr;

  ctx.watch([
    { side: 'buy', price: emaSlow, trigger: 'above', note: 'EMA50>EMA200' },
    { side: 'sell', price: emaSlow, trigger: 'below', note: 'EMA50<EMA200' },
    ...(stop != null ? [{ side: 'sell', price: stop, trigger: 'below', note: 'ATR stop' }] : [])
  ]);

  // exit: ATR stop on the open side
  if (pos !== 0 && stop != null) {
    if ((pos > 0 && ctx.price <= stop) || (pos < 0 && ctx.price >= stop)) {
      return { side: pos > 0 ? 'sell' : 'buy', qty: Math.abs(pos), reduceOnly: true };
    }
  }

  // switch to short when trend turns down
  if (pos > 0 && !bull) {
    return { side: 'sell', qty: pos, reduceOnly: true };
  }
  // switch to long when trend turns up
  if (pos < 0 && bull) {
    return { side: 'buy', qty: Math.abs(pos), reduceOnly: true };
  }

  // open new position in the trend direction, confirmed by rising fast EMA
  if (pos === 0) {
    if (bull && rising) {
      const qty = (ctx.cash / ctx.price) * 0.95;
      if (qty <= 0) return null;
      return { side: 'buy', qty: qty };
    }
    if (!bull && !rising) {
      const qty = (ctx.cash / ctx.price) * 0.95;
      if (qty <= 0) return null;
      return { side: 'sell', qty: qty };
    }
  }

  return null;
}
