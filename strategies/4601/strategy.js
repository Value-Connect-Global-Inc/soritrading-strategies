/*
 * @coinsori-strategy v1
 * name: MultiAsset Trend EMA50/200 + TP 4H
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: the EMA50/200 trend core (strategy 4597) is the one family
 * with repeated out-of-sample evidence here (+285/+112/+57% on three disjoint
 * 4h windows). Its stated weakness is that in a topping process the death cross
 * fires late and gives back a large part of the gain. This version adds a
 * take-profit lock at 6 ATR above entry (~2.4x the 2.5-ATR stop, a standard
 * risk/reward ratio) so a strong move is banked early; if the trend is still
 * intact after the cooldown, it re-enters and rides the continuation.
 * When it buys and sells: buy on a bullish EMA50/200 cross or while the trend
 * is intact (EMA50>EMA200 and price above the 400-period average); sell on a
 * death cross, when price falls 2.5 ATR below entry, or when price rises 6 ATR
 * above entry (take profit). 24-bar cooldown after any exit.
 * When it does NOT work: in a long choppy sideways range the crossovers
 * whipsaw and stops turn small dips into realized losses; long-only means a
 * sustained bear market is flat-to-loss; a take-profit can sell too early in a
 * powerful straight-line trend that never pulls back.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const f = ctx.ema(50, 1), s = ctx.ema(200, 1);
  const fp = ctx.ema(50, 2), sp = ctx.ema(200, 2);
  const sma400 = ctx.sma(400, 1);
  const atr = ctx.atr(14, 1);
  if (f == null || s == null || fp == null || sp == null || sma400 == null || atr == null) return null;

  const sym = ctx.sym;
  const st = ctx.state || {};
  if (!st.cool) st.cool = {};

  const pos = ctx.position;
  if (pos > 0) {
    const entry = ctx.entryPx;
    const stopPx = entry != null ? entry - 2.5 * atr : price - 2.5 * atr;
    // Take profit: bank a strong move at ~2.4x the stop distance (6 vs 2.5 ATR).
    // In a topping process the death cross fires late; this locks the gain early.
    const tpPx = entry != null ? entry + 6 * atr : null;
    if (f <= s) { st.cool[sym] = ctx.i; return { side: 'sell', qty: pos }; } // death cross -> trend over
    if (price <= stopPx) { st.cool[sym] = ctx.i; return { side: 'sell', qty: pos }; }
    if (tpPx != null && price >= tpPx) { st.cool[sym] = ctx.i; return { side: 'sell', qty: pos }; }
    ctx.watch([
      { side: 'sell', price: stopPx, trigger: 'below', note: 'stop 2.5 ATR from entry' },
      { side: 'sell', price: tpPx, trigger: 'above', note: 'take profit 6 ATR' }
    ]);
    return null;
  }

  const lastExit = st.cool[sym];
  if (lastExit != null && ctx.i - lastExit < 24) return null;

  let enter = false;
  if (fp <= sp && f > s) enter = true;
  else if (f > s && price > sma400) enter = true;
  if (!enter) return null;

  const riskCash = ctx.cash * 0.01;
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.99) / price;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
