/*
 * @coinsori-strategy v1
 * name: BB Mean Reversion 1H
 * ex: binance
 * syms: BTC/USDT
 * interval: 1h
 * cash: 10000
 *
 * Why this strategy: in ranging markets, price snaps back to the mean after
 * over-extended moves. A close far below the lower Bollinger band with a low
 * RSI marks a short-term oversold bounce; a close far above the upper band with
 * a high RSI marks an overbought top. This is a mean-reversion family — the
 * opposite of all the trend-following work done so far — and it trades the
 * short swings trend systems miss.
 * When it buys and sells: it buys when the 1h close closes below the lower BB
 * band AND RSI(14) is below 30 (oversold); it sells when price climbs back to
 * the middle band (mean), or RSI turns up, or price drops 3xATR below entry.
 * When it does NOT work: in a strong one-way trend it keeps buying falling
 * knives and selling rising rockets — mean reversion loses precisely where
 * trend wins. It needs a range.
 */

function onUpdate(ctx) {
  const price = ctx.price;
  const pos = ctx.position || 0;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) { ctx.watch([]); return null; }

  // Use closed bars for the signals so backtest/live/paper agree.
  const bb = ctx.bb(20, 2, 1);
  const rsi = ctx.rsi(14, 1);
  if (bb == null || rsi == null) { ctx.watch([]); return null; }

  if (pos > 0) {
    const atrNow = ctx.atr(14, 1);
    const entry = ctx.entryPx;
    // Hard stop: 3xATR below entry, or mean reversion target = middle band.
    let stop = atrNow != null && entry != null ? entry - 3 * atrNow : prevClose * 0.97;
    const target = bb.mid;
    ctx.watch([
      { side: 'sell', price: target, trigger: 'above', note: 'Revert to mean' },
      { side: 'sell', price: stop, trigger: 'below', note: 'Stop' }
    ]);
    if (prevClose >= target || prevClose <= stop) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  if (ctx.closes.length < 40) { ctx.watch([]); return null; }
  // Oversold: close below lower band AND RSI below 30.
  if (prevClose < bb.lower && rsi < 30) {
    const atrNow = ctx.atr(14, 1);
    // Risk 2% of equity over the 3xATR stop, capped at full cash.
    let qty = ctx.cash / price * 0.99;
    if (atrNow != null && atrNow > 0) qty = Math.min(qty, (ctx.cash * 0.02) / (3 * atrNow));
    ctx.watch([{ side: 'buy', price: bb.lower, trigger: 'below', note: 'Oversold bounce', conds: [{ label: 'RSI14', now: rsi, op: '<', ref: 30, closed: true }] }]);
    return { side: 'buy', qty };
  }
  ctx.watch([{ side: 'buy', price: bb.lower, trigger: 'below', note: 'Oversold bounce', conds: [{ label: 'RSI14', now: rsi, op: '<', ref: 30, closed: true }] }]);
  return null;
}
