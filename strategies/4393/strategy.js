/*
 * @coinsori-strategy v1
 * name: Stochastic Oversold Trend Bounce
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The stochastic oscillator (14,3) measures where price sits
 *   inside its recent range. A fresh turn UP out of the oversold zone while BTC
 *   trades above its 50-day EMA is a low-risk point to enter a bounce; we ride
 *   it until the oscillator turns down from overbought or the trend breaks,
 *   with a hard ATR stop underneath.
 * When it buys and sells: buy when %K crosses above %D while %K < 30 (was
 *   oversold) and close > 50-day EMA. Sell when %K crosses below %D while
 *   %K > 70, close breaks the 50-day EMA, or a 2.5x ATR stop hits.
 * When it does NOT work: in a raging bull price rarely returns to oversold so
 *   we miss part of the uptrend; in a chop the oscillator whipsaws and the
 *   stops bleed. Long-only BTC, single asset.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const st1 = ctx.stoch(14, 3, 1);   // closed-bar stochastic (identical in bt/paper/live)
  const st2 = ctx.stoch(14, 3, 2);
  const ema50 = ctx.ema(50, 1);
  const atr = ctx.atr(14, 1);
  if (st1 == null || st2 == null || st1.k == null || st1.d == null || st2.k == null || st2.d == null) return null;
  if (ema50 == null || atr == null || atr <= 0) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const hardStop = ctx.entryPx - 2.5 * atr;    // hard stop on every position
    if (price <= hardStop) return { side: 'sell', qty: pos };
    if (st1.k < st1.d && st1.k > 70) return { side: 'sell', qty: pos };   // overbought turn down
    if (prevClose < ema50) return { side: 'sell', qty: pos };              // trend break
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2.5x ATR stop' },
               { side: 'sell', price: ema50, trigger: 'below', note: '50-day trend break' }]);
    return null;
  }

  const oversoldCross = st2.k <= st2.d && st1.k > st1.d && st1.k < 30;   // turn up from oversold
  const trendUp = prevClose > ema50;
  ctx.watch([{ side: 'buy', price: ema50, trigger: 'above', note: 'stoch up-cross from <30',
             conds: [{ label: 'close > 50-EMA', ok: trendUp, closed: true }] }]);
  if (!oversoldCross || !trendUp) return null;

  const riskCash = ctx.cash * 0.05;              // risk 5% of cash per trade
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash / price) * 0.95;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
