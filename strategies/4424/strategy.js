/*
 * @coinsori-strategy v1
 * name: BTC Panic-Dip Mean Reversion 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: after an extreme short-term panic (RSI(2) below 10) inside a
 * long-term uptrend, buyers historically step back in and price bounces. This is
 * mean reversion — the opposite family from the trend-following champion.
 * When it buys and sells: buys when the last closed bar has RSI(2) below 10 while
 * price is above the 200-day EMA (only panic-buys in an uptrend, never catches a
 * falling knife in a bear market). Sells when RSI(2) recovers above 70, price
 * closes below the 200-day EMA, or a 2.5x ATR hard stop is hit. Sized at 3% risk.
 * When it does NOT work: in a sustained bear market the trend filter keeps it in
 * cash (no loss but no gain), and in a crash the dip can keep dipping — the hard
 * stop caps but does not prevent losses. RSI(2) extremes are rare, so it trades
 * only a few times a year.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const rsi2 = ctx.rsi(2, 1);
  const ema200 = ctx.ema(200, 1);
  const atr = ctx.atr(14, 1);
  if (rsi2 == null || ema200 == null || atr == null || atr <= 0) return null;

  const pos = ctx.pos(ctx.sym);
  const prevClose = ctx.closes.at(-2);

  if (pos > 0) {
    const stop = ctx.entryPx - 2.5 * atr;   // hard stop: 2.5x daily ATR below entry
    if (price <= stop) return { side: 'sell', qty: pos };
    if (prevClose != null && prevClose < ema200) return { side: 'sell', qty: pos };
    const bounced = rsi2 > 70;              // mean reversion target: short-term bounce complete
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '2.5x ATR stop' },
               { side: 'sell', price: ema200, trigger: 'below', note: '200-day trend break',
                 conds: [{ label: 'RSI(2) bounce >70', ok: bounced, closed: true }] }]);
    if (bounced) return { side: 'sell', qty: pos };
    return null;
  }

  if (prevClose == null) return null;
  const uptrend = prevClose > ema200;
  const panic = rsi2 < 10;
  ctx.watch([{ side: 'buy', price: prevClose, trigger: 'below', note: 'RSI(2) panic dip',
               conds: [{ label: 'RSI(2) close', now: rsi2, op: '<', ref: 10, closed: true },
                       { label: 'close > 200-EMA', ok: uptrend, closed: true }] }]);
  if (!uptrend || !panic) return null;

  const riskCash = ctx.cash * 0.03;         // risk 3% of cash per trade
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash / price) * 0.95;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
