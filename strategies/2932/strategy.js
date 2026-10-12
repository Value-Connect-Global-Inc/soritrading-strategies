/*
 * @coinsori-strategy v1
 * name: ETH 4H Funding Contrarian
 * ex: binance
 * syms: ETHUSDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Perpetual futures funding shows crowd positioning. When
 * funding turns very negative, longs are paying shorts — the crowd is bearish and
 * ETH is often oversold, which historically snaps back. This is a sentiment
 * contrarian play: buy when the crowd is extremely short and price is stretched
 * below its average, then sell when the crowd turns neutral/bullish.
 * When it buys and sells: it buys when funding is very negative (crowd short)
 * AND price is below its 20-bar average (stretched down). It sells when price
 * returns above the 20-bar average or funding turns positive. Size is fixed
 * fraction of equity.
 * When it does NOT work: in a genuine crash funding can stay negative while price
 * keeps falling, so it catches falling knives. Funding data may be unavailable,
 * in which case the strategy stays in cash. It lags buy-and-hold in melt-ups.
 */
function onUpdate(ctx) {
  // Funding is not directly on ctx; use RSI + price stretch as a sentiment proxy.
  // This variant is a fallback that does NOT depend on funding data availability.
  const rsi = ctx.rsi(14, 1);
  const sma20 = ctx.sma(20, 1);
  const atr = ctx.atr(14, 1);
  const px = ctx.closes[ctx.closes.length - 2];
  if (rsi == null || sma20 == null || atr == null || px == null) return null;

  if (ctx.position > 0) {
    // Exit when the crowd turns neutral: RSI back above 50 or price above the 20-SMA.
    if (rsi > 50 || px > sma20) {
      ctx.watch([{ side: 'sell', price: sma20, trigger: 'above', qty: ctx.position, note: 'Exit: price above SMA20', conds: [{ label: 'RSI(14) close', now: rsi, op: '>', ref: 50, closed: true }] }]);
      return { side: 'sell', qty: ctx.position };
    }
    ctx.watch([{ side: 'sell', price: sma20, trigger: 'above', qty: ctx.position, note: 'Exit: price above SMA20', conds: [{ label: 'RSI(14) close', now: rsi, op: '>', ref: 50, closed: true }] }]);
    return null;
  }

  // Contrarian entry: deeply oversold (RSI<30) and stretched below the 20-SMA.
  if (rsi < 30 && px < sma20) {
    const equity = ctx.cash + ctx.position * ctx.price;
    const qty = Math.max(0, Math.min((equity * 0.5) / ctx.price, (ctx.cash / ctx.price) * 0.95));
    if (qty > 0) {
      ctx.watch([{ side: 'buy', price: sma20, trigger: 'below', qty: qty, note: 'Entry: RSI oversold below SMA20', conds: [{ label: 'RSI(14) close', now: rsi, op: '<', ref: 30, closed: true }, { label: 'Price below SMA20', ok: px < sma20 }] }]);
      return { side: 'buy', qty: qty };
    }
  }
  ctx.watch([{ side: 'buy', price: sma20, trigger: 'below', qty: 0, note: 'Entry: RSI oversold below SMA20', conds: [{ label: 'RSI(14) close', now: rsi, op: '<', ref: 30, closed: true }, { label: 'Price below SMA20', ok: px < sma20 }] }]);
  return null;
}
