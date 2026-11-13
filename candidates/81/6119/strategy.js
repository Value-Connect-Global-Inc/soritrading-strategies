/*
 * @coinsori-strategy v1
 * name: BTC 4H Z-Score Mean Reversion Both Sides
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * marketType: usdm
 * cash: 10000
 *
 * Why this strategy: BTC overshoots its short-term average in both directions — panic dips below
 * 2 stdevs and euphoric rips above 2 stdevs both tend to snap back. Trading both sides captures
 * mean reversion that a long-only version misses (a long-only variant lost to holding in every
 * window because it had to sell winners at the mean).
 * When it buys and sells: buys when the close is 2 stdevs below its 50-bar mean, sells when it
 * returns to the mean; shorts when the close is 2 stdevs above its 50-bar mean, covers when it
 * returns to the mean. A 10% stop on both sides limits the damage when the move is a real trend,
 * not a reversion.
 * When it does NOT work: in a strong one-way trend it gets run over — the 10% stops take losses
 * on every counter-trend entry. It earns its keep in ranging, volatile markets.
 */

function onUpdate(ctx) {
  const close = ctx.closes.at(-2);       // last closed bar
  const z = ctx.zscore(50, 1);           // stdevs of close around its 50-bar mean
  const mean = ctx.sma(50, 1);           // reversion target
  const sd = ctx.stdev(50, 1);           // for the entry levels
  if (close == null || z == null || mean == null || sd == null || ctx.price == null) {
    ctx.watch([]);
    return null;
  }

  const pos = ctx.position;
  const entryPx = ctx.entryPx;
  const inLong = pos > 0;
  const inShort = pos < 0;
  const longStop = (inLong && entryPx != null) ? entryPx * 0.90 : null;   // 10% stop on longs
  const shortStop = (inShort && entryPx != null) ? entryPx * 1.10 : null; // 10% stop on shorts (squeeze risk)

  const buyLvl = mean - 2 * sd;          // the z=-2 dip level
  const sellLvl = mean + 2 * sd;          // the z=+2 rip level

  const watchList = [
    { side:'buy', price: buyLvl, trigger:'below', note:'z<-2 buy dip' },
    { side:'sell', price: sellLvl, trigger:'above', note:'z>+2 short rip' }
  ];
  if (longStop != null) watchList.push({ side:'sell', price: longStop, trigger:'below', note:'long stop' });
  if (shortStop != null) watchList.push({ side:'buy', price: shortStop, trigger:'above', note:'short stop' });
  ctx.watch(watchList);

  if (inLong) {
    if (z >= 0) return { side:'sell', qty: pos, reduceOnly: true };
    if (longStop != null && ctx.price <= longStop) return { side:'sell', qty: pos, reduceOnly: true };
    return null;
  }
  if (inShort) {
    if (z <= 0) return { side:'buy', qty: -pos, reduceOnly: true };
    if (shortStop != null && ctx.price >= shortStop) return { side:'buy', qty: -pos, reduceOnly: true };
    return null;
  }

  if (ctx.alloc && ctx.alloc.status !== 'ok') return null; // no new entries while edge is reduce-only
  if (z < -2.0) return { side:'buy', qty: ctx.cash / ctx.price * 0.95 };
  if (z > 2.0) return { side:'sell', qty: ctx.cash / ctx.price * 0.95 };
  return null;
}
