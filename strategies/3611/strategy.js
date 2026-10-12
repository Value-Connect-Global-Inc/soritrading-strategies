/*
 * @coinsori-strategy v1
 * name: BTC Hashrate Regime Trend 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: bitcoin's hashrate is a fundamental proxy for network
 *   strength — when the network is GROWING (hashrate above its own 30-period
 *   average), the asset has a healthy base to trend on. This is a different
 *   external-data family than sentiment (fear-greed) or macro (DXY).
 * When it buys and sells: buy when hashrate > its precomputed 30-period average
 *   (network expanding), price is above its 100-EMA and makes a fresh 20-bar
 *   high; sell when price closes below the 20-bar low or hits a 2.5x ATR hard
 *   stop. No profit-taking on strength — winners run.
 * When it does NOT work: hashrate is slow-moving, so it does not time entries
 *   well and can stay "on" during a price decline; in a bear market the gate
 *   helps but the trend entry still loses. Defensive fundamental rider.
 */
function onUpdate(ctx) {
  const hr = ctx.data('hashrate');
  const hrAvg = ctx.data('hashrate_sma30');
  if (hr == null || hrAvg == null) return null;   // no fundamental data yet

  const atr = ctx.atr(14, 1);
  const ema100 = ctx.ema(100, 1);
  if (atr == null || ema100 == null) return null;
  const price = ctx.price;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  if (ctx.position > 0) {
    const hardStop = ctx.entryPx - 2.5 * atr;
    const ll20 = ctx.low(20, 2);
    if (price <= hardStop) return { side: 'sell', qty: ctx.position };
    if (ll20 != null && prevClose <= ll20) return { side: 'sell', qty: ctx.position };
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2.5x ATR hard stop' },
               { side: 'sell', price: ll20, trigger: 'below', note: '20-bar channel exit' }]);
    return null;
  }

  if (hr <= hrAvg) return null;      // network shrinking = stay out (fundamental gate)
  if (prevClose <= ema100) return null;      // only buy in an uptrend
  const hh20 = ctx.high(20, 2);
  if (hh20 == null || prevClose <= hh20) return null;   // enter only on a FRESH breakout

  // risk 2% of cash on a 2.5x ATR stop, capped by available cash
  const riskCash = ctx.cash * 0.02;
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.99) / price;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
