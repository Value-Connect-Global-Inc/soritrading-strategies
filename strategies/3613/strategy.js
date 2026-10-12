/*
 * @coinsori-strategy v1
 * name: BTC Sentiment-Gated Trend 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: the Fear & Greed index is the only indicator that has added
 *   defensive value in this account's tests, and the SOL version (3609) is the
 *   best of the gate family. This is a GENERALIZATION test of that exact logic
 *   on BTC — does the sentiment gate work on the most liquid asset too?
 * When it buys and sells: buy when Fear&Greed < 75, price above its 100-EMA and
 *   making a fresh 20-bar high; sell on a 20-bar low close or a 2.5x ATR hard
 *   stop. No profit-taking on greed — winners run.
 * When it does NOT work: in a melt-up it enters late and misses part of the move;
 *   in a slow grind down with mild fear the EMA gate keeps it out but it also
 *   misses the bottom. Defensive trend rider, not a bull champion.
 */
function onUpdate(ctx) {
  const fg = ctx.data('fg');
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

  if (fg != null && fg >= 75) return null;   // only a blow-off top blocks entry (fg null = data off, skip gate)
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
