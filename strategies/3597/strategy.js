/*
 * @coinsori-strategy v1
 * name: ETH Trend-Follow EMA50/200 4H Chandelier
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: The EMA50/200 crossover trend core passed a pure generalization
 *   test on ETH 4h (+223/+35/+55 across three disjoint windows). Its weakness is a
 *   ~30% MDD: waiting for the death cross gives back a lot of trend profit. A first
 *   attempt at a plain chandelier trailing stop failed badly (whipsaw: 270 trades,
 *   all windows negative), so this version only starts trailing once the trade is up
 *   3x ATR — a profit-lock trail that preserves the ride-the-trend character.
 * When it buys and sells: buys on a bullish EMA50/200 crossover above SMA200, and
 *   re-buys while flat if EMA50>EMA200 and price>SMA400 (trend intact). Sells on a
 *   death cross, the hard 2.5x ATR stop, or once in profit, a 3x ATR trailing stop
 *   below the highest high since entry — whichever comes first.
 * When it does NOT work: in choppy sideways ranges the crossover whipsaws; long-only
 *   means a sustained bear market is flat-to-loss; a trailing stop can exit right
 *   before a resumed trend (exit-side whipsaw).
 */
function onUpdate(ctx) {
  const f = ctx.ema(50, 1), s = ctx.ema(200, 1);
  const fp = ctx.ema(50, 2), sp = ctx.ema(200, 2);
  const sma200 = ctx.sma(200, 1);
  const sma400 = ctx.sma(400, 1);
  const atr = ctx.atr(14, 1);
  if (f == null || s == null || fp == null || sp == null || sma200 == null || sma400 == null || atr == null) return null;
  const price = ctx.price;
  const prevClose = ctx.closes.at(-2);

  if (ctx.position > 0) {
    // track the highest high since entry
    let hh = ctx.state.hhSinceEntry;
    if (hh == null) hh = ctx.entryPx;
    const lastHigh = ctx.high(1, 1);
    if (lastHigh != null) hh = Math.max(hh, lastHigh);
    hh = Math.max(hh, price);
    ctx.state.hhSinceEntry = hh;

    const hardStop = ctx.entryPx - 2.5 * atr;
    let stopPx = hardStop;
    // only start trailing once the trade is up 3x ATR (profit-lock) — this is what
    // separates locking in real gains from the whipsaw of trailing from entry.
    if (hh >= ctx.entryPx + 3.0 * atr) {
      const chandStop = hh - 3.0 * atr;
      if (chandStop > stopPx) stopPx = chandStop;
    }
    if (price <= stopPx) return { side: 'sell', qty: ctx.position };
    if (fp > sp && f <= s) return { side: 'sell', qty: ctx.position };
    ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: 'trail/hard stop' }]);
    return null;
  }

  // entry: fresh bullish cross, OR re-entry while trend intact above SMA400
  let enter = false;
  if (fp <= sp && f > s && prevClose > sma200) enter = true;
  else if (f > s && prevClose > sma400) enter = true;
  if (!enter) return null;

  const riskCash = ctx.cash * 0.02;
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.99) / price;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  ctx.state.hhSinceEntry = price; // start the trailing high at entry
  return { side: 'buy', qty };
}
