/*
 * @coinsori-strategy v1
 * name: ETH Sentiment-Gated Trend 4H
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: the proven SOL champion (sentiment-gated trend 4h) is
 *   tested here on ETH — a different asset in the same crypto market. The
 *   question is whether the edge (buy 20-bar breakouts when fear&greed is not
 *   at a blow-off top and the trend is up) generalizes beyond SOL.
 * When it buys and sells: identical logic to the SOL champion — buy when
 *   Fear&Greed < 75, price above 100-EMA, fresh 20-bar high; sell on 20-bar
 *   low close or 2.5x ATR hard stop.
 * When it does NOT work: same as SOL — misses melt-ups, and ETH has its own
 *   moves that may not align with the sentiment index timing.
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
