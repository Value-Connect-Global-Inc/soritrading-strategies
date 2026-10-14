/*
 * @coinsori-strategy v1
 * name: BTC 4H Donchian Breakout
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: On the 4-hour chart, a close above the 20-bar high marks a
 *   short-term breakout that tends to continue for a few days, and the much
 *   tighter 10-bar low exit gets out fast on reversals. This is a faster,
 *   intraday-frequency cousin of the daily Donchian basket: it trades more
 *   often and carries far lower drawdown per trade, at the cost of more fees.
 * When it buys and sells: buy on a fresh 20-bar high close. Sell on a 10-bar
 *   low close or a hard 2x ATR stop.
 * When it does NOT work: in a sideways chop it whipsaws and pays fees on every
 *   false breakout; in a fast crash the 10-bar low exit is still slower than
 *   the move, so the hard stop takes the damage. It underperforms buy-and-hold
 *   in a straight-line bull because it exits and re-enters instead of riding.
 */
function onUpdate(ctx) {
  const sym = ctx.sym;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const pos = ctx.pos(sym);

  if (pos > 0) {
    const hardStop = ctx.entryPx - 2 * atr;
    const ll10 = ctx.low(10, 2);
    if (price <= hardStop) return { side: 'sell', qty: pos };
    if (ll10 != null && prevClose <= ll10) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2x ATR stop' },
               { side: 'sell', price: ll10, trigger: 'below', note: '10-bar channel exit' }]);
    return null;
  }

  const hh20 = ctx.high(20, 2);
  if (hh20 == null) return null;  // not enough history yet
  ctx.watch([{ side: 'buy', price: hh20, trigger: 'above', note: '20-bar breakout' }]);
  if (prevClose <= hh20) return null;  // need a fresh 20-bar high close

  const riskCash = ctx.cash * 0.02;
  const stopDist = 2 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash / price) * 0.50; // single asset, cap at 50% of cash
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
