/*
 * @coinsori-strategy v1
 * name: ETH Mean-Reversion Dip 4H
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: In a healthy uptrend Ethereum still pulls back hard and fast, and those
 * over-extended dips (price below the lower Bollinger band with RSI deeply oversold) tend to snap
 * back toward the short-term average. We only buy dips that happen ABOVE the 200-bar average, so we
 * never try to catch a falling knife in a downtrend.
 * When it buys and sells: it buys when the closed 4h bar is below the lower Bollinger band (20,2)
 * and RSI(14) is below 30 while the close is above the 200-bar average. It sells when the price
 * mean-reverts back up to the 20-bar average, when the trend breaks below the 200-bar average, or
 * when price drops 2xATR below entry (hard stop).
 * When it does NOT work: in a straight-line melt-up there are almost no oversold dips so it stays out
 * and trails buy-and-hold; in a long chop it gets stopped out repeatedly; in a violent crash the
 * regime filter keeps it flat, which is safe but useless.
 */

function onUpdate(ctx) {
  const price = ctx.price;
  const pos = ctx.position || 0;

  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) { ctx.watch([]); return null; }
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) { ctx.watch([]); return null; }

  const rsi = ctx.rsi(14, 1);
  const bb = ctx.bb(20, 2, 1);
  const sma20 = ctx.sma(20, 1);
  const atr = ctx.atr(14, 1);
  if (rsi == null || bb == null || sma20 == null) { ctx.watch([]); return null; }

  // Regime filter: only mean-revert inside an uptrend. If the trend breaks, close immediately.
  if (prevClose < sma200) {
    if (pos > 0) {
      ctx.watch([{ side: 'sell', price: sma200, trigger: 'below', note: 'Trend broke - exit' }]);
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'Wait for uptrend' }]);
    return null;
  }

  if (pos > 0) {
    const entry = ctx.entryPx;
    // Hard stop: 2xATR below entry. Risk ~6% of equity on a full position.
    const stopPx = (entry != null && atr != null) ? entry - 2 * atr : price * 0.85;
    ctx.watch([
      { side: 'sell', price: sma20, trigger: 'above', note: 'Mean-revert target' },
      { side: 'sell', price: stopPx, trigger: 'below', note: '2xATR stop' }
    ]);
    if (prevClose >= sma20 || prevClose <= stopPx) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  // Entry: oversold dip inside an uptrend.
  if (rsi < 30 && prevClose < bb.lower) {
    let qty = ctx.cash / price * 0.99;
    if (atr != null && atr > 0) {
      // Risk 30% of equity on the 2xATR stop, capped at full cash.
      qty = Math.min(qty, (ctx.cash * 0.30) / (2 * atr));
    }
    ctx.watch([{ side: 'buy', price: bb.lower, trigger: 'below', note: 'Oversold dip',
      conds: [{ label: 'RSI(14) close', now: rsi, op: '<', ref: 30, closed: true }] }]);
    return { side: 'buy', qty };
  }
  ctx.watch([{ side: 'buy', price: bb.lower, trigger: 'below', note: 'Oversold dip',
    conds: [{ label: 'RSI(14) close', now: rsi, op: '<', ref: 30, closed: true }] }]);
  return null;
}
