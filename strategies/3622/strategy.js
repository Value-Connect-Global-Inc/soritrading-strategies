/*
 * @coinsori-strategy v1
 * name: ETH Mean Reversion 4H
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: in an uptrend, sharp pullbacks to oversold levels tend to
 *   bounce back. This is the counter-trend family (opposite of the breakout
 *   trend strategy): buy the dip, not the breakout.
 * When it buys and sells: buy when RSI(14) is oversold (<35) AND price is at
 *   least 5% below its 20-bar high AND the close is still above the 100-EMA
 *   (uptrend intact). Sell when RSI recovers to 55, when the close falls back
 *   below the 100-EMA, or on a 3x ATR hard stop.
 * When it does NOT work: in strong one-way markets (melt-ups never pull back to
 *   oversold, so it stays out; bear markets break the 100-EMA and it never buys).
 */
function onUpdate(ctx) {
  const rsi = ctx.rsi(14, 1);
  const atr = ctx.atr(14, 1);
  const ema100 = ctx.ema(100, 1);
  if (rsi == null || atr == null || ema100 == null) return null;

  const price = ctx.price;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  if (ctx.position > 0) {
    const hardStop = ctx.entryPx - 3 * atr;
    const trendBreak = prevClose < ema100;
    const rsiRecovered = ctx.rsi(14, 1);
    if (price <= hardStop) return { side: 'sell', qty: ctx.position };
    if (trendBreak) return { side: 'sell', qty: ctx.position };
    if (rsiRecovered != null && rsiRecovered >= 55) return { side: 'sell', qty: ctx.position };
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '3x ATR hard stop' },
               { side: 'sell', price: ema100, trigger: 'below', note: '100-EMA trend break' },
               { side: 'sell', price: null, note: 'RSI >= 55 mean reversion done' }]);
    return null;
  }

  if (prevClose <= ema100) return null;              // only mean-revert inside an uptrend
  if (rsi >= 35) return null;                        // not oversold yet
  const hh20 = ctx.high(20, 1);
  if (hh20 == null) return null;
  if (prevClose > hh20 * 0.95) return null;          // need a real dip, not a stall

  // risk 2% of cash on a 3x ATR stop, capped by available cash
  const riskCash = ctx.cash * 0.02;
  const stopDist = 3 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.99) / price;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
