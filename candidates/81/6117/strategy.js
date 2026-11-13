/*
 * @coinsori-strategy v1
 * name: ETH Donchian Trend 4H (no VIX)
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: ETH trends in long swings; a close above the 55-bar high usually starts
 * a sustained move. Pure trend breakout with no macro filter, used as the baseline variant.
 * When it buys and sells: buys ETH when the close breaks above the 55-bar high; sells when the
 * close breaks below the 20-bar low, or as a safety stop if price falls 20% below entry.
 * When it does NOT work: in a long sideways chop the 55-bar breakout whipsaws and the 20-bar
 * exit cuts small losses repeatedly.
 */

function onUpdate(ctx) {
  const close = ctx.closes.at(-2);          // last closed bar
  const hi55 = ctx.high(55, 2);             // 55-bar high BEFORE last closed bar -> breakout level
  const lo20 = ctx.low(20, 2);              // 20-bar low BEFORE last closed bar -> trend exit level
  if (close == null || hi55 == null || lo20 == null || ctx.price == null) {
    ctx.watch([]);
    return null;
  }

  const inPos = ctx.position > 0;
  const entryPx = ctx.entryPx;
  const stopPx = (inPos && entryPx != null) ? entryPx * 0.80 : null; // 20% hard stop vs gap-downs

  const watchList = [
    { side:'buy', price: hi55, trigger:'above', note:'55-bar breakout' },
    { side:'sell', price: lo20, trigger:'below', note:'20-bar low exit' }
  ];
  if (stopPx != null) watchList.push({ side:'sell', price: stopPx, trigger:'below', note:'20% hard stop' });
  ctx.watch(watchList);

  if (inPos) {
    if (close < lo20) return { side:'sell', qty: ctx.position, reduceOnly: true };
    if (stopPx != null && ctx.price <= stopPx) return { side:'sell', qty: ctx.position, reduceOnly: true };
    return null;
  }

  if (ctx.alloc && ctx.alloc.status !== 'ok') return null; // no new entries while edge is reduce-only
  if (close > hi55) {
    return { side:'buy', qty: ctx.cash / ctx.price * 0.99 };
  }
  return null;
}
