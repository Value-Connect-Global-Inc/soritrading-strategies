/*
 * @coinsori-strategy v1
 * name: Donchian Basket with 200-SMA Regime Filter 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, XRP/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Same 5-coin Donchian breakout basket as the champion
 *   (55-bar high entry, 20-bar low exit, 2.5x ATR hard stop, 20% per leg) but
 *   new breakouts are only taken when the coin's close is above its 200-day
 *   SMA. The 200-day regime filter skips breakout entries that fire inside a
 *   long-term downtrend and then reverse — cutting the basket's worst drawdown
 *   without touching the exits that make the champion strong.
 * When it buys and sells: buy on a fresh 55-bar high close above both the
 *   100-day EMA and the 200-day SMA. Sell on a 20-bar low close, the 2.5x ATR
 *   hard stop, or a close below the 100-day EMA.
 * When it does NOT work: in a broad coordinated crypto bear all five legs go
 *   flat (safe, no upside); in a V-shaped recovery from a bear, the 200-day
 *   filter keeps it in cash during the early rebound, so it misses the first
 *   leg up that the champion would catch.
 */
function onUpdate(ctx) {
  const sym = ctx.sym;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const atr = ctx.atr(14, 1);
  const ema100 = ctx.ema(100, 1);
  const sma200 = ctx.sma(200, 1);
  if (atr == null || atr <= 0 || ema100 == null || sma200 == null) return null;
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
  if (hh55 == null) return null;  // not enough history yet
  ctx.watch([{ side: 'buy', price: hh55, trigger: 'above', note: '55-bar breakout',
               conds: [{ label: 'close > 100-EMA', ok: prevClose > ema100, closed: true },
                       { label: 'close > 200-SMA', ok: prevClose > sma200, closed: true }] }]);
  if (prevClose <= hh55) return null;  // need a fresh 55-bar high close
  if (prevClose < ema100) return null;
  if (prevClose < sma200) return null;  // regime filter: no breakouts in long-term downtrend

  const riskCash = ctx.cash * 0.02;
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash / price) * 0.20; // cap each leg at 20% of cash
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
