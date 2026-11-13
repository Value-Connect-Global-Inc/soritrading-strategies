/*
 * @coinsori-strategy v1
 * name: BTC 1D Donchian SMA200 Regime
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: BTC's biggest gains come from sustained multi-week trends. A close above the
 * 55-day high starts most of them. The 200-day average filter keeps the strategy out of bear
 * markets: it only buys breakouts while price is already above the 200-day average, so it rides
 * uptrends and steps aside in downtrends (a VIX gate that blocked the 2023-26 rally was tried
 * and rejected — the SMA200 filter is the version that participates in recoveries).
 * When it buys and sells: buys when the close breaks above the 55-day high AND is above the
 * 200-day average; sells when the close breaks below the 30-day low, or as a safety stop if
 * price falls 20% below entry.
 * When it does NOT work: in a long sideways range the breakout whipsaws and the 30-day exit
 * cuts small losses repeatedly; in a bear market it stays in cash and earns nothing while
 * waiting for a new uptrend.
 */

function onUpdate(ctx) {
  const close = ctx.closes.at(-2);       // last closed bar
  const hi55 = ctx.high(55, 2);          // 55-day high BEFORE last closed bar -> breakout level
  const lo30 = ctx.low(30, 2);           // 30-day low BEFORE last closed bar -> trend exit level
  const sma200 = ctx.sma(200, 1);        // long-term trend filter
  if (close == null || hi55 == null || lo30 == null || sma200 == null || ctx.price == null) {
    ctx.watch([]);
    return null;
  }

  const inPos = ctx.position > 0;
  const entryPx = ctx.entryPx;
  const stopPx = (inPos && entryPx != null) ? entryPx * 0.80 : null; // 20% hard stop vs gap-downs

  const watchList = [
    { side:'buy', price: hi55, trigger:'above', note:'55d breakout', conds:[{ label:'above SMA200', ok: close > sma200 }] },
    { side:'sell', price: lo30, trigger:'below', note:'30d low exit' }
  ];
  if (stopPx != null) watchList.push({ side:'sell', price: stopPx, trigger:'below', note:'20% hard stop' });
  ctx.watch(watchList);

  if (inPos) {
    if (close < lo30) return { side:'sell', qty: ctx.position, reduceOnly: true };
    if (stopPx != null && ctx.price <= stopPx) return { side:'sell', qty: ctx.position, reduceOnly: true };
    return null;
  }

  if (ctx.alloc && ctx.alloc.status !== 'ok') return null; // no new entries while edge is reduce-only
  if (close > hi55 && close > sma200) {
    return { side:'buy', qty: ctx.cash / ctx.price * 0.99 };
  }
  return null;
}
