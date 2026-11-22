/*
 * @coinsori-strategy v1
 * name: ETH Trend-Ride ATR Trailing 4H
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: ETH spends most of its time in multi-week trends. Instead of
 * buying falling dips (which loses money), we enter only when a pullback has already
 * turned back up inside an uptrend, then ride the trend with a trailing stop so
 * winners run while a hard ATR stop caps any single loss.
 * When it buys and sells: BUY when the last closed bar reclaimed the 20-EMA while
 * the 20-EMA is above the 100-EMA (pullback reversal in an uptrend); SELL when price
 * closes back below the 20-EMA or falls to the trailing stop (highest high since
 * entry minus 3x ATR).
 * When it does NOT work: In a choppy sideways market the signals whipsaw and fees
 * pile up; in a fast crash the 20-EMA exit lags, so the trailing stop is the real
 * protection and still takes a loss.
 */
function onUpdate(ctx) {
  const ema20 = ctx.ema(20, 1);
  const ema100 = ctx.ema(100, 1);
  const atr = ctx.atr(14, 1);
  if (ema20 == null || ema100 == null || atr == null) return null;

  const prevClose = ctx.closes.at(-2);
  const prevPrevClose = ctx.closes.at(-3);
  const price = ctx.price;
  const pos = ctx.position || 0;
  const hh = ctx.state.hh || prevClose;            // highest high since entry (restart-safe)

  // ---- exits ----
  if (pos > 0) {
    const newHh = Math.max(hh, price);
    ctx.state.hh = newHh;
    const trail = newHh - 3 * atr;                 // chandelier trailing stop
    ctx.watch([
      { side: 'sell', price: ema20, trigger: 'below', note: 'trend exit EMA20' },
      { side: 'sell', price: trail, trigger: 'below', note: 'trailing stop' }
    ]);
    if (prevClose < ema20 || price <= trail) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  // ---- entry: last closed bar reclaimed the 20-EMA inside an uptrend ----
  if (prevClose > ema20 && prevPrevClose <= ema20 && prevClose > ema100) {
    const qty = (ctx.cash / ctx.price) * 0.98;
    if (qty <= 0) return null;
    ctx.state.hh = prevClose;
    ctx.watch([{ side: 'buy', price: ema20, trigger: 'above', note: 'pullback reversal',
      conds: [{ label: 'EMA20>EMA100', ok: ema20 > ema100 },
              { label: 'closed above EMA20', ok: prevClose > ema20 }] }]);
    return { side: 'buy', qty };
  }

  ctx.watch([]);
  return null;
}
