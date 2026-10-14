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
 *   trades above its 200-day average is a low-risk point to enter a bounce;
 *   we ride it until the oscillator turns down from overbought or the 200-day
 *   trend breaks, with a hard ATR stop underneath.
 * When it buys and sells: buy when %K crosses above %D inside oversold (<20) and
 *   close > 200-day SMA. Sell when %K crosses below %D from overbought (>80),
 *   close breaks the 200-day SMA, or a 2.5x ATR stop hits.
 * When it does NOT work: in a raging bull price rarely returns to oversold so we
 *   miss much of the uptrend; in a chop the oscillator whipsaws. Long-only BTC.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const st1 = ctx.stoch(14, 3, 1);   // closed-bar stochastic (identical in bt/paper/live)
  const st2 = ctx.stoch(14, 3, 2);
  const sma200 = ctx.sma(200, 1);
  const atr = ctx.atr(14, 1);
  if (st1 == null || st2 == null || st1.k == null || st1.d == null || st2.k == null || st2.d == null) return null;
  if (sma200 == null || atr == null || atr <= 0) return null;

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const hardStop = ctx.entryPx - 2.5 * atr;    // hard stop on every position
    if (price <= hardStop) return { side: 'sell', qty: pos };
    const prevClose = ctx.closes.at(-2);
    if (st1.k < st1.d) return { side: 'sell', qty: pos };          // oscillator turned down
    if (prevClose < sma200) return { side: 'sell', qty: pos };      // trend break
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2.5x ATR stop' },
               { side: 'sell', price: sma200, trigger: 'below', note: '200-day trend break' }]);
    return null;
  }

  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;
  const oversoldCross = st2.k <= st2.d && st1.k > st1.d && st1.k < 20;   // turn up from oversold
  const trendUp = prevClose > sma200;
  ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'stoch up-cross from <20',
             conds: [{ label: 'close > 200-SMA', ok: trendUp, closed: true }] }]);
  if (!oversoldCross || !trendUp) return null;

  const riskCash = ctx.cash * 0.05;              // risk 5% of cash per trade
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash / price) * 0.95;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
