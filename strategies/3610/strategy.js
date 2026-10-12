/*
 * @coinsori-strategy v1
 * name: BTC DXY Regime Trend 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: the dollar index (DXY) is a risk-on/risk-off switch for
 *   crypto — when the dollar is weak, liquidity flows into risk assets; when it
 *   is strong, crypto struggles. This uses DXY as an ENTRY regime filter only
 *   (a different external-data family than the fear-greed gate).
 * When it buys and sells: buy when DXY is below its own 120-bar average
 *   (dollar weak = risk-on) and price is above its 100-EMA making a fresh 20-bar
 *   high; sell when price closes below the 20-bar low or hits a 2.5x ATR hard
 *   stop. No profit-taking on regime — winners run.
 * When it does NOT work: in a melt-up that happens WHILE the dollar strengthens
 *   it stays out and misses the move; the DXY regime changes slowly, so it
 *   whipsaws a little around regime flips. Defensive regime rider.
 */
function onUpdate(ctx) {
  const dxy = ctx.data('dxy');
  if (dxy == null) return null;   // no macro data yet — skip (never treat as 0)

  // maintain a rolling DXY history in state to compute its own regime average
  const st = ctx.state || {};
  const arr = st.dxyArr || [];
  arr.push(dxy);
  if (arr.length > 120) arr.shift();
  st.dxyArr = arr;
  if (arr.length < 120) return null;
  const avg = arr.reduce((a, b) => a + b, 0) / arr.length;

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

  if (dxy >= avg) return null;     // dollar strong = risk-off, stay out (regime gate)
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
