/*
 * @coinsori-strategy v1
 * name: BTC 4H Pullback-in-Uptrend
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: In a confirmed macro uptrend, deep pullbacks (price below
 *   the 50-EMA with RSI reset) are re-entry points with good risk/reward — the
 *   trend resumes more often than it reverses. We buy the deep dip and ride the
 *   resumption.
 * When it buys and sells: buy when the 50-EMA is above the 200-EMA (uptrend) AND
 *   price closed below the 50-EMA AND RSI(14) is below 30 (deep dip); sell when
 *   price closes above the 20-EMA (resumed) or on a 2x ATR stop. We do NOT exit
 *   on EMA50 breaks — mid-pullback dips below it are normal and exiting there
 *   caused churn.
 * When it does NOT work: in a topping market the "dip" is the start of a
 *   reversal and the stop takes repeated losses. In a choppy range the 50/200
 *   cross whipsaws and it buys fake dips.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const ema20 = ctx.ema(20, 1);
  const ema50 = ctx.ema(50, 1);
  const ema200 = ctx.ema(200, 1);
  const rsi = ctx.rsi(14, 1);
  const atr = ctx.atr(14, 1);
  if (ema20 == null || ema50 == null || ema200 == null || rsi == null || atr == null) return null;

  const pos = ctx.position;
  if (pos > 0) {
    const stopPx = ctx.entryPx - 2 * atr;
    if (price <= stopPx) return { side: 'sell', qty: pos };   // dip became reversal
    if (price > ema20) return { side: 'sell', qty: pos };     // resumed — take profit
    ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: 'stop' },
               { side: 'sell', price: ema20, trigger: 'above', note: 'resumed' }]);
    return null;
  }

  // deep-pullback entry: macro uptrend + price under 50-EMA + RSI reset
  if (ema50 <= ema200) return null;      // no uptrend
  if (price >= ema50) return null;       // not below the 50-EMA — no dip
  if (rsi >= 30) return null;            // not deeply oversold — dip not done

  const riskCash = ctx.cash * 0.01;      // 1% equity risked per trade
  const stopDist = 2 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.30) / price; // cap position at 30% of cash
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
