/*
 * @coinsori-strategy v1
 * name: Volatility Squeeze Breakout Basket 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, XRP/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Volatility regime, not price trend. Crypto alternates
 *   between calm (Bollinger bandwidth compressed) and explosive moves.
 *   A breakout from a squeeze is a cleaner, earlier signal than the champion's
 *   55-bar breakout which can fire after a move is already extended. Each coin
 *   runs its own squeeze breakout with a 2.5x ATR hard stop, sized to 20% of
 *   cash.
 * When it buys and sells: buy a coin when its close breaks above the 20-bar
 *   high AND the Bollinger(20,2) bandwidth is compressed (<4%). Sell on a
 *   20-bar low close or the 2.5x ATR hard stop.
 * When it does NOT work: in a low-volatility grind that never breaks out it
 *   sits idle; during a high-volatility regime the 4% bandwidth filter rarely
 *   triggers, so it misses sustained trends and underperforms the 1D champion.
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
    const ll20 = ctx.low(20, 2);
    const hardStop = ctx.entryPx - 2.5 * atr;
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2.5x ATR stop' },
               { side: 'sell', price: ll20, trigger: 'below', note: '20-bar channel exit' }]);
    if (price <= hardStop) return { side: 'sell', qty: pos };
    if (ll20 != null && prevClose <= ll20) return { side: 'sell', qty: pos };
    return null;
  }

  // squeeze detection: Bollinger(20,2) bandwidth under 4% of the mid
  const bb = ctx.bb(20, 2, 1);
  if (bb == null) return null;
  const bw = (bb.upper - bb.lower) / bb.mid;
  if (bw > 0.04) return null; // not squeezed — skip

  const hh20 = ctx.high(20, 2);
  if (hh20 == null) return null;
  ctx.watch([{ side: 'buy', price: hh20, trigger: 'above', note: 'post-squeeze breakout',
               conds: [{ label: 'BB width < 4%', now: bw, op: '<', ref: 0.04, closed: true }] }]);
  if (prevClose <= hh20) return null;

  const riskCash = ctx.cash * 0.02;      // risk 2% of cash per leg on the stop
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash / price) * 0.20; // cap each leg at 20% of cash
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
