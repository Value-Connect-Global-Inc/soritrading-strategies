/*
 * @coinsori-strategy v1
 * name: BTC 4H Donchian SMA200 Regime
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: BTC trends in multi-week swings; a close above the 20-day high usually
 * starts one. The 200-bar (33-day) average filter keeps it out of bear markets: it only buys
 * breakouts while price is already above that average, so it rides uptrends and steps aside in
 * downtrends. Same regime idea as the BTC 1D version but on 4h bars, which trades far more
 * often (the 1D version beat holding in every window but traded only ~5 times a year).
 * When it buys and sells: buys when the close breaks above the 120-bar (20-day) high AND is
 * above the 200-bar average; sells when the close breaks below the 60-bar (10-day) low, or as
 * a safety stop if price falls 20% below entry.
 * When it does NOT work: in a long sideways range the breakout whipsaws; in a bear market it
 * stays in cash and earns nothing while waiting for a new uptrend.
 */

function onUpdate(ctx) {
  const close = ctx.closes.at(-2);       // last closed bar
  const hi120 = ctx.high(120, 2);        // 20-day high BEFORE last closed bar -> breakout level
  const lo60 = ctx.low(60, 2);           // 10-day low BEFORE last closed bar -> trend exit level
  const sma200 = ctx.sma(200, 1);        // long-term trend filter
  if (close == null || hi120 == null || lo60 == null || sma200 == null || ctx.price == null) {
    ctx.watch([]);
    return null;
  }

  const inPos = ctx.position > 0;
  const entryPx = ctx.entryPx;
  const stopPx = (inPos && entryPx != null) ? entryPx * 0.80 : null; // 20% hard stop vs gap-downs

  const watchList = [
    { side:'buy', price: hi120, trigger:'above', note:'20d breakout', conds:[{ label:'above SMA200', ok: close > sma200 }] },
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
  if (close > hi120 && close > sma200) {
    return { side:'buy', qty: ctx.cash / ctx.price * 0.99 };
  }
  return null;
}
