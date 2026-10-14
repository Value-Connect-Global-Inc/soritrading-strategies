/*
 * @coinsori-strategy v1
 * name: Multi-Asset Donchian Basket 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, XRP/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Five major cryptos run an independent Donchian breakout
 *   (55-bar high entry, 20-bar low exit) with a 2.5x ATR hard stop, each sized
 *   to 20% of cash. Donchian breaks only the 200-day filter's habit of buying
 *   late and selling late; the ledger showed this recipe on a basket beats the
 *   plain 200d trend basket on the same windows. Diversification is the point:
 *   winners carry losers, and each coin's own stop caps its damage.
 * When it buys and sells: for each coin, buy on a fresh 55-bar high close with a
 *   hard 2.5x ATR stop. Sell on a 20-bar low close, the ATR stop, or a close
 *   back below its 100-day EMA.
 * When it does NOT work: in a broad coordinated crypto bear all five legs go
 *   flat (safe, no upside); the 55-bar entry buys late into melt-ups and the
 *   20-bar exit sells late into dips, so it underperforms buy-and-hold of the
 *   hottest coin in a straight-line rally.
 */
function onUpdate(ctx) {
  const sym = ctx.sym;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const atr = ctx.atr(14, 1);
  const ema100 = ctx.ema(100, 1);
  if (atr == null || atr <= 0 || ema100 == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const pos = ctx.pos(sym);

  if (pos > 0) {
    const hardStop = ctx.entryPx - 2.5 * atr;
    const ll20 = ctx.low(20, 2);
    if (price <= hardStop) return { side: 'sell', qty: pos };
    if (ll20 != null && prevClose <= ll20) return { side: 'sell', qty: pos };
    if (prevClose < ema100) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2.5x ATR stop' },
               { side: 'sell', price: ll20, trigger: 'below', note: '20-bar channel exit' },
               { side: 'sell', price: ema100, trigger: 'below', note: '100-EMA break' }]);
    return null;
  }

  const hh55 = ctx.high(55, 2);
  if (hh55 == null || prevClose <= hh55) return null;  // need a fresh 55-bar high close
  if (prevClose < ema100) return null;

  const riskCash = ctx.cash * 0.02;
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash / price) * 0.20; // cap each leg at 20% of cash
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
