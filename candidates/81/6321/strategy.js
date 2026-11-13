/*
 * @coinsori-strategy v1
 * name: BTC Z-Score Mean Reversion 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: after sharp short-term drops BTC often snaps back to its recent average, so buying deep oversold dips and selling back to the mean captures that bounce.
 * When it buys and sells: buys when the last closed price is ~2 standard deviations below its 100-bar average (and only while price is above its 200-bar average, i.e. an uptrend regime); sells back to the average or at a 2.5xATR hard stop.
 * When it does NOT work: in a sustained bear market price keeps falling far below the average and the bounce never comes — the hard stop caps each loss but the strategy misses the trend and can take repeated small stops.
 */
function onUpdate(ctx) {
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const mean = ctx.sma(100, 1);
  const std = ctx.stdev(100, 1);
  const atr = ctx.atr(14, 1);
  const sma200 = ctx.sma(200, 1);
  if (mean == null || std == null || atr == null || sma200 == null) return null;

  const z = (prevClose - mean) / std;
  const stopDist = 2.5 * atr; // 2.5xATR: wide enough to survive noise, tight enough to cap a failed bounce

  if (ctx.position <= 0) {
    // regime filter: only buy dips in an uptrend regime (price above its 200-bar average) to avoid catching falling knives
    const trendUp = prevClose > sma200;
    const zLevel = mean - 2.0 * std; // price level where z-score hits -2.0
    ctx.watch([{ side: 'buy', price: zLevel, trigger: 'below', note: 'z<=-2 oversold', conds: [{ label: 'z-score(100)', now: z, op: '<', ref: -2, closed: true }, { label: 'above SMA200', ok: trendUp }] }]);
    if (z <= -2.0 && trendUp) {
      // risk-size: lose at most 1.5% of cash if the stop is hit
      const qty = (ctx.cash * 0.015) / stopDist;
      const cap = (ctx.cash / ctx.price) * 0.98; // keep 2% cash buffer for fees
      return { side: 'buy', qty: Math.min(qty, cap) };
    }
    return null;
  }

  // in a position: exit back to the mean or at the hard stop
  const entry = ctx.entryPx;
  if (entry == null) { ctx.watch([]); return null; }
  const stop = entry - stopDist;
  ctx.watch([
    { side: 'sell', price: mean, trigger: 'above', note: 'back to mean' },
    { side: 'sell', price: stop, trigger: 'below', note: 'hard stop' }
  ]);
  if (prevClose >= mean || prevClose <= stop) {
    return { side: 'sell', qty: ctx.position, reduceOnly: true };
  }
  return null;
}
