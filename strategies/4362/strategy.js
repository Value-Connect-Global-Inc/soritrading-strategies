/*
 * @coinsori-strategy v1
 * name: Donchian Basket with Chandelier Trailing Stop 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, XRP/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Same 5-coin Donchian breakout basket as the champion, but
 *   the exit is a chandelier trailing stop (22-bar highest high minus 3x ATR)
 *   instead of a slow 20-bar low close. The trailing stop locks in more of a
 *   trend's gains and exits faster on sharp dips, fixing the champion's known
 *   weakness of selling late. Each coin still carries a hard 2.5x ATR stop and
 *   each leg is capped at 20% of cash.
 * When it buys and sells: buy on a fresh 55-bar high close above the 100-day
 *   EMA. Sell when the close falls below the chandelier trailing stop, the hard
 *   2.5x ATR stop, or the 100-day EMA.
 * When it does NOT work: in a broad coordinated crypto bear all five legs go
 *   flat (safe, no upside); the 55-bar entry still buys late into melt-ups; in
 *   a choppy range the tighter trailing stop churns more than the 20-bar low
 *   exit and pays extra fees.
 */
function onUpdate(ctx) {
  const sym = ctx.sym;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const atr = ctx.atr(14, 1);
  const ema100 = ctx.ema(100, 1);
  const hh22 = ctx.high(22, 2);
  if (atr == null || atr <= 0 || ema100 == null || hh22 == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const pos = ctx.pos(sym);

  if (pos > 0) {
    const hardStop = ctx.entryPx - 2.5 * atr;
    const chandelier = hh22 - 3 * atr; // trailing stop: lock in gains as trend advances
    if (price <= hardStop) return { side: 'sell', qty: pos };
    if (prevClose < chandelier) return { side: 'sell', qty: pos };
    if (prevClose < ema100) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2.5x ATR hard stop' },
               { side: 'sell', price: chandelier, trigger: 'below', note: 'chandelier trailing stop' },
               { side: 'sell', price: ema100, trigger: 'below', note: '100-EMA break' }]);
    return null;
  }

  const hh55 = ctx.high(55, 2);
  if (hh55 == null) return null;  // not enough history yet
  ctx.watch([{ side: 'buy', price: hh55, trigger: 'above', note: '55-bar breakout',
               conds: [{ label: 'close > 100-EMA', ok: prevClose > ema100, closed: true }] }]);
  if (prevClose <= hh55) return null;  // need a fresh 55-bar high close
  if (prevClose < ema100) return null;

  const riskCash = ctx.cash * 0.02;
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash / price) * 0.20; // cap each leg at 20% of cash
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
