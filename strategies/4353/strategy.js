/*
 * @coinsori-strategy v1
 * name: FearGreed-Filtered Donchian Basket 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, XRP/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The 5-coin Donchian breakout basket is the validated
 *   champion. This variant adds a sentiment risk-filter: it skips breakouts
 *   taken during extreme greed (Fear & Greed >= 80), on the idea that buying
 *   a fresh high while the crowd is already euphoric is buying late into a
 *   rally. Uses sentiment as a risk-filter, not as a contrarian entry signal.
 * When it buys and sells: for each coin, buy on a fresh 55-bar high close only
 *   when the Fear & Greed index is below 80. Sell on a 20-bar low close, a
 *   2.5x ATR stop, or a close back below the 100-day EMA.
 * When it does NOT work: in a sustained melt-up where the index stays pinned at
 *   extreme greed for weeks, it sits in cash and misses the strongest part of
 *   the rally. The index is daily and sentiment is noisy, so the filter can
 *   whipsaw around the 80 level.
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

  // Sentiment risk-filter: skip entries in extreme greed (euphoria).
  const fg = ctx.data('fear_greed');
  const notEuphoric = fg == null || fg < 80;

  const pos = ctx.pos(sym);

  if (pos > 0) {
    const hardStop = ctx.entryPx - 2.5 * atr;
    const ll20 = ctx.low(20, 2);
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2.5x ATR stop' },
               { side: 'sell', price: ll20, trigger: 'below', note: '20-bar channel exit' },
               { side: 'sell', price: ema100, trigger: 'below', note: '100-EMA break' }]);
    if (price <= hardStop) return { side: 'sell', qty: pos };
    if (ll20 != null && prevClose <= ll20) return { side: 'sell', qty: pos };
    if (prevClose < ema100) return { side: 'sell', qty: pos };
    return null;
  }

  const hh55 = ctx.high(55, 2);
  if (hh55 == null) return null;
  ctx.watch([{ side: 'buy', price: hh55, trigger: 'above', note: '55-bar breakout',
               conds: [{ label: 'no extreme greed (FG < 80)', ok: notEuphoric, closed: true },
                       { label: 'close > 100-EMA', ok: prevClose > ema100, closed: true }] }]);
  if (prevClose <= hh55) return null;
  if (prevClose < ema100) return null;
  if (!notEuphoric) return null;

  const riskCash = ctx.cash * 0.02;
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash / price) * 0.20;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
