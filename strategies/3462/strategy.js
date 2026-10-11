/*
 * @coinsori-strategy v1
 * name: BTC Daily Multi Momentum Trend
 * ex: binance
 * syms: BTC
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Captures powerful daily trends on Bitcoin using multi-horizon rate-of-change and moving average filters.
 * When it buys and sells: Buys when the 20-day and 50-day price momentum are positive and price is above the 200-day SMA. Sells when momentum reverses or trend breaks.
 * When it does NOT work: Suffers drawdowns during choppy sideways consolidation or sudden macroeconomic trend reversals.
 */

function onUpdate(ctx) {
  if (ctx.i < 200) return null;

  const price = ctx.price;
  const sma200 = ctx.sma(200, 1);
  const roc20 = ctx.change(20, 1);
  const roc50 = ctx.change(50, 1);
  const rsi = ctx.rsi(14, 1);

  if (sma200 == null || roc20 == null || roc50 == null || rsi == null) return null;

  const inPos = ctx.position > 0;

  ctx.watch([
    { side: 'buy', price: sma200, trigger: 'above', note: 'Trend filter SMA200', conds: [
      { label: 'ROC20 > 0', now: roc20, op: '>', ref: 0, closed: true },
      { label: 'ROC50 > 0', now: roc50, op: '>', ref: 0, closed: true }
    ]},
    { side: 'sell', price: ctx.entryPx ? ctx.entryPx * 0.85 : price * 0.85, trigger: 'below', note: 'Stop loss 15%' }
  ]);

  if (!inPos) {
    if (price > sma200 && roc20 > 0 && roc50 > 0 && rsi < 75) {
      const qty = (ctx.cash * 0.98) / price;
      return { side: 'buy', qty: qty };
    }
  } else {
    if (roc20 < -2 || price < sma200 || rsi < 40) {
      return { side: 'sell', qty: ctx.position };
    }
  }

  return null;
}
