/*
 * @coinsori-strategy v1
 * name: SOL Mean Reversion Bounce 4H
 * ex: binance
 * syms: SOL/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: SOL is volatile and mean-reverting in ranges — sharp dips below the
 *   lower Bollinger band on oversold RSI tend to snap back to the middle band. Buying
 *   those bounces inside an uptrend and taking profit at the mean is a different
 *   behaviour than riding a trend — this works in chop, the regime the trend-follower
 *   underperforms in.
 * When it buys and sells: buys when flat AND price is below the lower Bollinger(20,2)
 *   AND RSI(14) is oversold AND price is above the 200-bar average (uptrend only).
 *   Sells at the middle Bollinger band or when RSI turns up above 60, with a hard
 *   2.5x ATR stop so no single trade can hurt the account.
 * When it does NOT work: in a strong one-way trend price can keep falling through the
 *   lower band and the stops chain — a straight rally also leaves it flat after the
 *   first bounce, so a bull run underperforms buy-and-hold.
 */
function onUpdate(ctx) {
  const price = ctx.closes.at(-2);
  if (price == null) return null;
  const atr = ctx.atr(14, 1);
  const bb = ctx.bb(20, 2, 1);
  const rsi = ctx.rsi(14, 1);
  if (atr == null || bb == null || rsi == null) return null;

  // ---- exit ----
  if (ctx.position > 0) {
    // hard stop: never lose more than 2.5x ATR from entry (~10% on SOL 4h). The
    // sizing below is built on this exact distance, so the stop must exist.
    const stopPx = ctx.entryPx - 2.5 * atr;
    if (price <= stopPx) return { side: 'sell', qty: ctx.position };
    // mean-reversion target: the middle band is where the bounce is expected to go
    if (price >= bb.mid) return { side: 'sell', qty: ctx.position };
    // RSI turned up through 60 = bounce played out, take the money
    if (rsi >= 60) return { side: 'sell', qty: ctx.position };
    ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: 'hard stop' },
               { side: 'sell', price: bb.mid, trigger: 'above', note: 'mean target' }]);
    return null;
  }

  // ---- entry only when flat ----
  // trend filter: only buy dips inside a long-term uptrend (above 200-bar average).
  // Oversold in a bear market is a falling knife, not a bounce.
  const sma200 = ctx.sma(200, 1);
  if (sma200 == null || price < sma200) return null;

  // oversold bounce: price below lower band AND RSI below 30. RSI<30 is the deeper
  // oversold condition — SOL 4h reaches it a few times a year, so trades are rare.
  if (price < bb.lower && rsi < 30) {
    // size so the 2.5x ATR stop loses ~2% of cash (can't ruin the account)
    const riskCash = ctx.cash * 0.02;
    const stopDist = 2.5 * atr;
    let qty = stopDist > 0 ? riskCash / stopDist : 0;
    const maxQty = (ctx.cash * 0.99) / ctx.price;
    if (qty > maxQty) qty = maxQty;
    if (qty <= 0) return null;
    return { side: 'buy', qty };
  }
  ctx.watch([{ side: 'buy', price: bb.lower, trigger: 'below', note: 'BB lower bounce', conds: [{ label: 'RSI(14)', now: rsi, op: '<', ref: 30, closed: true }, { label: 'price>SMA200', ok: price > sma200 }] }]);
  return null;
}
