/*
 * @coinsori-strategy v1
 * name: BTC Trend Regime Filter 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * A long-only trend-regime filter. BTC spends most of its time trending; a slow
 * moving average separates up-trends (stay invested) from down-trends (sit in cash).
 * Entry needs a clear break above the trend (avoid whipsaw), but exit reacts fast
 * (leave shortly after the trend turns down) so crashes are cut early. It loses in
 * choppy sideways markets, where repeated false signals pay fees, and it lags
 * holding in a relentless one-way bull.
 */

function onUpdate(ctx) {
  // Trend filter on CLOSED bars only (ago>=1) — identical in backtest, paper and live.
  const ma = ctx.ema(200, 1);
  const atr = ctx.atr(14, 1);
  const close = ctx.closes.at(-2);
  if (ma == null || close == null) return null;

  // Entry needs half an ATR above the trend (filter noise); exit is tighter at a
  // quarter ATR below (cut crashes early). Asymmetric on purpose.
  const entryBand = (atr == null) ? 0 : 0.5 * atr;
  const exitBand = (atr == null) ? 0 : 0.25 * atr;
  const pos = ctx.position || 0;

  // Declare the exact levels the order logic trades on (rule 6).
  ctx.watch([
    { side: 'buy', price: ma + entryBand, trigger: 'above', note: 'trend up - enter' },
    { side: 'sell', price: ma - exitBand, trigger: 'below', note: 'trend down - exit' }
  ]);

  if (pos <= 0) {
    if (close > ma + entryBand) {
      const qty = ctx.cash / ctx.price * 0.99;
      if (qty <= 0) return null;
      return { side: 'buy', qty: qty };
    }
    return null;
  }

  if (close < ma - exitBand) {
    return { side: 'sell', qty: pos, reduceOnly: true };
  }
  return null;
}
