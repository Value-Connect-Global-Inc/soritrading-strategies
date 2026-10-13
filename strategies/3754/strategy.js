/*
 * @coinsori-strategy v1
 * name: BTC Bull-Regime RSI Dip Buy 4H
 * ex: binanceusdm
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: mean reversion — in a confirmed bull uptrend (price above a rising
 * 200-SMA), short sharp oversold dips and ride the bounce back to the mean. This is a
 * different family from the trend-following and dual-side strategies: it buys weakness
 * instead of strength.
 * When it buys and sells: buy when RSI(14) closes below 30 while price is above a rising
 * 200-SMA. Sell when RSI recovers above 55, price reaches +1.5x ATR from entry, or the
 * 2x ATR hard stop is hit. Sits in cash when there is no confirmed uptrend.
 * When it does NOT work: in a bear market the bull filter keeps it flat (no loss, no gain);
 * in a choppy sideways range above the 200-SMA it buys dips that keep dipping and hits the
 * stop repeatedly.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) { ctx.watch([]); return null; }
  const sma200 = ctx.sma(200, 1);
  const sma200ago20 = ctx.sma(200, 21);   // slope of the 200-SMA over the last 20 bars
  const atr = ctx.atr(14, 1);
  const rsi = ctx.rsi(14, 1);             // closed-bar RSI — the dip signal
  if (sma200 == null || sma200ago20 == null || atr == null || atr <= 0 || rsi == null) { ctx.watch([]); return null; }
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) { ctx.watch([]); return null; }

  // Bull regime: price above a 200-SMA that itself rose >0.05% over 20 bars.
  // 0.05% drift is a slow-but-real uptrend; below that the SMA is flat and dips whipsaw.
  const slopePct = (sma200 / sma200ago20 - 1) * 100;
  const bullUp = prevClose > sma200 && slopePct > 0.05;

  const pos = ctx.position;
  if (pos > 0) {
    const hardStop = ctx.entryPx - 2 * atr;
    const target = ctx.entryPx + 1.5 * atr;
    if (price <= hardStop) { ctx.watch([]); return { side: 'sell', qty: pos }; }
    if (rsi > 55 || price >= target) { ctx.watch([]); return { side: 'sell', qty: pos }; }
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2x ATR stop' },
               { side: 'sell', price: target, trigger: 'above', note: '1.5x ATR target' },
               { side: 'sell', conds: [{ label: 'RSI(14) close', now: rsi, op: '>', ref: 55, closed: true }], note: 'reverted to mean' }]);
    return null;
  }

  if (!bullUp) { ctx.watch([]); return null; }   // no dip-buying outside a confirmed uptrend
  if (rsi >= 30) { ctx.watch([]); return null; } // only genuinely oversold closes

  const riskCash = 0.01 * ctx.cash;              // risk 1% per trade via the 2x ATR stop
  let qty = riskCash / (2 * atr);
  const maxQty = (ctx.cash * 0.99) / price;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) { ctx.watch([]); return null; }
  ctx.watch([{ side: 'buy', conds: [{ label: 'RSI(14) close', now: rsi, op: '<', ref: 30, closed: true },
                                    { label: 'price > rising SMA200', ok: bullUp }], note: 'oversold dip in bull' }]);
  return { side: 'buy', qty };
}
