/*
 * @coinsori-strategy v1
 * name: BTC Donchian Trend-Filtered 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Donchian breakouts capture trends but whipsaw badly in bear markets. Adding a
 * rising 200-SMA trend filter keeps only breakouts that happen inside an established uptrend,
 * cutting the repeated false breakouts in a downtrend.
 * When it buys and sells: buys when a closed daily bar breaks the 55-bar high AND price is above a
 * RISING 200-SMA. Sells on a 2x ATR hard stop or when a closed bar breaks the 20-bar low.
 * When it does NOT work: in choppy sideways markets the 55-bar breakout still whipsaws. It misses
 * the start of strong trends that begin below a falling 200-SMA (early recovery), and it is fully
 * out during bear markets so it never catches the bottom.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const c = ctx.closes;
  if (c.length < 220) return null;

  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0) return null;
  const sma200 = ctx.sma(200, 1);
  const sma200Prev = ctx.sma(200, 2);
  if (sma200 == null || sma200Prev == null) return null;

  let h55 = -Infinity;
  for (let k = 3; k <= 57; k++) h55 = Math.max(h55, c.at(-k));
  let l20 = Infinity;
  for (let k = 3; k <= 22; k++) l20 = Math.min(l20, c.at(-k));

  const NB = c.length - 2;
  const prevClose = c.at(-2);
  const pos = ctx.position;

  if (pos > 0) {
    const stop = ctx.entryPx == null ? null : ctx.entryPx - atr * 2;
    if (stop != null && price <= stop) return { side: 'sell', qty: pos };
    if (prevClose < l20) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '2x ATR stop' },
               { side: 'sell', price: l20, trigger: 'below', note: '20-bar low breakdown' }]);
    return null;
  }

  const trendUp = sma200 > sma200Prev; // rising long-term trend
  const aboveTrend = prevClose > sma200;
  if (!(prevClose > h55 && trendUp && aboveTrend)) {
    ctx.watch([{ side: 'buy', price: h55, trigger: 'above', note: '55-bar high breakout',
                 conds: [{ label: 'SMA200 rising', ok: trendUp, closed: true },
                         { label: 'above SMA200', ok: aboveTrend, closed: true }] }]);
    return null;
  }

  const qty = (ctx.cash * 0.99) / price;
  if (qty <= 0) return null;

  ctx.watch([{ side: 'buy', price: h55, trigger: 'above', note: '55-bar breakout in uptrend' }]);
  return { side: 'buy', qty };
}
