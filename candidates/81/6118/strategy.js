/*
 * @coinsori-strategy v1
 * name: ETH Donchian Trend 4H
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: ETH trends in long swings that last weeks; a close above the 20-day high
 * usually starts a sustained move. Turtle-style breakout channels sized for 4h bars. No macro
 * filter: a VIX regime filter was tested and reduced returns (it blocked the recovery after
 * the 2020 crash), so this is the plain breakout baseline.
 * When it buys and sells: buys ETH when the close breaks above the 120-bar (20-day) high; sells
 * when the close breaks below the 60-bar (10-day) low, or as a safety stop if price falls 20%
 * below entry.
 * When it does NOT work: in a long sideways chop the breakout whipsaws and the 10-day exit cuts
 * small losses repeatedly; the wide 20% stop means a single bad entry can draw down heavily.
 */

function onUpdate(ctx) {
  const close = ctx.closes.at(-2);          // last closed bar
  const hi120 = ctx.high(120, 2);           // 20-day high BEFORE last closed bar -> breakout level
  const lo60 = ctx.low(60, 2);              // 10-day low BEFORE last closed bar -> trend exit level
  if (close == null || hi120 == null || lo60 == null || ctx.price == null) {
    ctx.watch([]);
    return null;
  }

  const inPos = ctx.position > 0;
  const entryPx = ctx.entryPx;
  const stopPx = (inPos && entryPx != null) ? entryPx * 0.80 : null; // 20% hard stop vs gap-downs

  const watchList = [
    { side:'buy', price: hi120, trigger:'above', note:'20d breakout' },
    { side:'sell', price: lo60, trigger:'below', note:'10d low exit' }
  ];
  if (stopPx != null) watchList.push({ side:'sell', price: stopPx, trigger:'below', note:'20% hard stop' });
  ctx.watch(watchList);

  if (inPos) {
    if (close < lo60) return { side:'sell', qty: ctx.position, reduceOnly: true };
    if (stopPx != null && ctx.price <= stopPx) return { side:'sell', qty: ctx.position, reduceOnly: true };
    return null;
  }

  if (ctx.alloc && ctx.alloc.status !== 'ok') return null; // no new entries while edge is reduce-only
  if (close > hi120) {
    return { side:'buy', qty: ctx.cash / ctx.price * 0.99 };
  }
  return null;
}
