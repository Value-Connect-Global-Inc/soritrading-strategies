/*
 * @coinsori-strategy v1
 * name: BTC 1D Pullback Buy In Uptrend
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: in a confirmed long-term uptrend, sharp short-term pullbacks
 * (oversold RSI) tend to bounce because buyers step in at lower prices. We buy
 * the dip only when the 200-day EMA says we are still in a bull market, and we
 * take profit when the bounce gets overbought.
 * When it buys and sells: buys when the previous close is above the 200-day EMA
 * AND RSI(14) is below 40 (oversold within an uptrend). Sells when RSI(14) rises
 * above 65, or price closes below the 200-day EMA, or a 2.5x ATR hard stop is
 * hit.
 * When it does NOT work: in a strong trend with few dips it stays flat most of the
 * time; in a falling market (close below 200-day EMA) it never buys, so it
 * misses the bottom — it only trades confirmed uptrends. If the pullback keeps
 * falling, the 2.5x ATR stop caps the loss.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const ema200 = ctx.ema(200, 1);
  const atr = ctx.atr(14, 1);
  const rsi = ctx.rsi(14, 1);
  if (ema200 == null || atr == null || rsi == null || atr <= 0) return null;

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const stop = ctx.entryPx - 2.5 * atr;
    if (price <= stop) return { side: 'sell', qty: pos };
    const prevClose = ctx.closes.at(-2);
    if (prevClose != null && prevClose < ema200) return { side: 'sell', qty: pos };
    const overbought = rsi > 65;   // take profit when bounce gets overbought
    if (overbought) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '2.5x ATR stop' },
               { side: 'sell', price: ema200, trigger: 'below', note: '200-day trend break' },
               { side: 'sell', price: null, note: 'RSI overbought', conds: [{ label: 'RSI(14)', now: rsi, op: '>', ref: 65, closed: true }] }]);
    return null;
  }

  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;
  const uptrend = prevClose > ema200;
  ctx.watch([{ side: 'buy', price: null, note: 'RSI oversold in uptrend',
               conds: [{ label: 'RSI(14)', now: rsi, op: '<', ref: 40, closed: true },
                       { label: 'close > 200-EMA', ok: uptrend, closed: true }] }]);
  if (!uptrend || rsi >= 40) return null;

  const riskCash = ctx.cash * 0.02;
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash / price) * 0.95;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
