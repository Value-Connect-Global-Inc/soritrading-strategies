/*
 * @coinsori-strategy v1
 * name: BTC Active-Address Regime Trend 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: the number of ACTIVE addresses on the network is a
 *   usage/on-chain demand proxy — when address activity is growing (above its
 *   30-period average) there is real demand behind the price, a healthier base
 *   to trend on than pure price action. This is a different external-data family
 *   than sentiment (fear-greed), macro (DXY) or mining (hashrate).
 * When it buys and sells: buy when active addresses > their 30-period average
 *   (on-chain demand rising), price above its 100-EMA making a fresh 20-bar high;
 *   sell when price closes below the 20-bar low or hits a 2.5x ATR hard stop.
 *   No profit-taking on demand — winners run.
 * When it does NOT work: active-address data is noisy and slow, so it can lag
 *   price turns; in a price rally driven by speculation with flat on-chain usage
 *   the gate keeps it out entirely. Defensive on-chain rider.
 */
function onUpdate(ctx) {
  const addr = ctx.data('addr');
  const addrAvg = ctx.data('addr_sma30');
  if (addr == null || addrAvg == null) return null;   // no on-chain data yet

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

  if (addr <= addrAvg) return null;      // on-chain demand flat/shrinking = stay out
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
