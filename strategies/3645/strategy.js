/*
 * @coinsori-strategy v1
 * name: PureSMA200Trend
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: a control experiment to isolate the value of the on-chain
 * hashrate gate. This version is the same slow trend core (price above its 200-day
 * average) with the same 3x ATR hard stop, but NO hashrate condition at all.
 * When it buys and sells: buys when the previous close is above the 200-day average;
 * sells on a trend break (close below the 200-day average) or a hard 3x ATR stop
 * below the entry price.
 * When it does NOT work: whipsaws in flat chop around the 200-day average, and
 * misses the start of every new trend because the 200-day average is very slow.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const s200 = ctx.sma(200, 1);
  const atr = ctx.atr(14, 1);
  if (s200 == null || atr == null || atr <= 0) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const pos = ctx.position;
  const inTrend = prevClose > s200;

  if (pos > 0) {
    const hardStop = ctx.entryPx - 3 * atr;
    if (price <= hardStop || !inTrend) {
      ctx.watch([]);
      return { side: 'sell', qty: pos };
    }
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '3x ATR stop' }]);
    return null;
  }

  if (inTrend) {
    ctx.watch([{ side: 'sell', price: ctx.entryPx - 3 * atr, trigger: 'below', note: '3x ATR stop' }]);
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  ctx.watch([{ side: 'buy', price: price, trigger: 'above', note: 'close > SMA200 entry' }]);
  return null;
}
