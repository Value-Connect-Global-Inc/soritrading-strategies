/*
 * @coinsori-strategy v1
 * name: Multi-Asset Donchian Basket EMA-Slope
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, XRP/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Five major cryptos run an independent Donchian breakout
 *   (55-bar high entry, 20-bar low exit) with a 2.5x ATR hard stop, each sized
 *   to 20% of cash. On top of the basket sits a regime filter: only OPEN a new
 *   breakout when the coin's own 100-day EMA is RISING (today above yesterday).
 *   A breakout into a falling long-term trend is a bear-market rally that
 *   whipsaws; requiring an uptrending EMA removes those losing trades, which is
 *   exactly what the plain basket's recent flat/bear windows showed.
 * When it buys and sells: for each coin, buy on a fresh 55-bar high close with a
 *   hard 2.5x ATR stop, but only while the 100-day EMA is rising. Sell on a
 *   20-bar low close, the ATR stop, or a close back below its 100-day EMA.
 * When it does NOT work: in a choppy sideways market where the 100-EMA is flat
 *   it sits in cash and misses range rallies; in a straight-line rally it still
 *   buys late (55-bar entry) and sells late (20-bar exit), underperforming
 *   buy-and-hold of the hottest coin. The most recent 2-year window was still
 *   slightly negative (-4.7%) even with the filter.
 */
function onUpdate(ctx) {
  const sym = ctx.sym;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const atr = ctx.atr(14, 1);
  const ema100 = ctx.ema(100, 1);
  const ema100Prev = ctx.ema(100, 2);
  if (atr == null || atr <= 0 || ema100 == null || ema100Prev == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const pos = ctx.pos(sym);

  if (pos > 0) {
    const hardStop = ctx.entryPx - 2.5 * atr;
    const ll20 = ctx.low(20, 2);
    if (price <= hardStop) return { side: 'sell', qty: pos };
    if (ll20 != null && prevClose <= ll20) return { side: 'sell', qty: pos };
    if (prevClose < ema100) return { side: 'sell', qty: pos };
    ctx.watch([{ side:'sell', price: hardStop, trigger: 'below', note: '2.5x ATR stop' },
               { side:'sell', price: ll20, trigger: 'below', note: '20-bar channel exit' },
               { side:'sell', price: ema100, trigger: 'below', note: '100-EMA break' }]);
    return null;
  }

  const emaRising = ema100 > ema100Prev;  // long-term trend must be up
  const hh55 = ctx.high(55, 2);
  if (hh55 == null) return null;
  ctx.watch([{ side: 'buy', price: hh55, trigger: 'above', note: '55-bar breakout',
               conds: [{ label: 'close > 100-EMA', ok: prevClose > ema100, closed: true },
                       { label: '100-EMA rising', ok: emaRising, closed: true }] }]);
  if (prevClose <= hh55) return null;
  if (prevClose < ema100) return null;
  if (!emaRising) return null;

  const riskCash = ctx.cash * 0.02;
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash / price) * 0.20;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
