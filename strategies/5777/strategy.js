/*
 * @coinsori-strategy v1
 * name: BTC Turtle Donchian Breakout 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Classic turtle trend-following — enter only on a genuine 20-day breakout (rare),
 * ride the trend with a wide 10-day exit, and risk only a small fixed fraction of equity per trade.
 * The previous attempts failed by overtrading (entry on every bar above an average, tight stops).
 * This fixes both: entries are rare and exits are wide enough to survive normal noise.
 * When it buys and sells: Buy when the close breaks above the highest high of the last 20 days.
 * Position size is set so a 2×ATR stop costs about 2% of equity. Sell when the close falls below
 * the lowest low of the last 10 days (trend broken) or on the 2×ATR stop. After a losing trade it
 * waits 5 days before re-entering, so a failed breakout is not re-bought immediately.
 * When it does NOT work: In a long sideways chop, breakouts fail repeatedly (each small loss adds up).
 * It lags buy-and-hold in a smooth relentless bull because it exits pullbacks and re-enters higher.
 * It does not short, so it sits out bear markets instead of profiting from them.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const pos = ctx.position;
  const hi20 = ctx.high(20, 1); // highest high of last 20 CLOSED days
  const lo10 = ctx.low(10, 1);  // lowest low of last 10 CLOSED days
  const atr = ctx.atr(14, 1);
  if (hi20 == null || lo10 == null || atr == null) return null;

  if (pos > 0) {
    const entryPx = ctx.entryPx;
    const stopPx = (entryPx != null) ? entryPx - 2 * atr : null; // hard stop at entry minus 2×ATR
    ctx.watch([
      { side: 'sell', price: lo10, trigger: 'below', note: '10-day low exit' },
      { side: 'sell', price: stopPx, trigger: 'below', note: '2×ATR stop' }
    ]);
    if (price < lo10 || (stopPx != null && price < stopPx)) {
      if (ctx.entryPx != null && price < ctx.entryPx) {
        ctx.state.cooldown = ctx.i + 5; // losing trade: wait 5 days before re-entering
      }
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  if (ctx.state.cooldown != null && ctx.i < ctx.state.cooldown) return null;
  ctx.watch([{ side: 'buy', price: hi20, trigger: 'above', note: '20-day breakout entry' }]);
  if (price > hi20) {
    const riskPct = 0.02; // risk 2% of equity on a 2×ATR stop
    const stopDist = 2 * atr;
    const riskCash = ctx.cash * riskPct;
    let qty = riskCash / stopDist;
    const maxQty = ctx.cash / price * 0.98;
    if (qty > maxQty) qty = maxQty;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
