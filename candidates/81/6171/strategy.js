/*
 * @coinsori-strategy v1
 * name: BTC 4H Dual-Short Turtle
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: BTC trends in both directions on the 4h chart; a long-only system misses the short side of every bear leg. Trading the perpetual with a regime filter that goes short below the 200-bar SMA captures down-trends too instead of just sitting out.
 * When it buys and sells: buys when price is above its 200-bar SMA and breaks the 55-bar high; sells short when price is below the 200-bar SMA and breaks the 55-bar low; exits on the opposite 20-bar break or a 3xATR stop.
 * When it does NOT work: in a sideways chop every breakout fails and the stop locks in repeated small losses; whipsaw costs are highest right after a regime flip around the SMA200.
 */

function onUpdate(ctx) {
  const atr = ctx.atr(14, 1);
  const sma200 = ctx.sma(200, 1);
  const close1 = ctx.closes.at(-2);
  if (atr == null || sma200 == null || close1 == null) return null;

  // Donchian channels from CLOSED bars only (k starts at 2, current bar excluded).
  let hh = -Infinity;
  for (let k = 2; k <= 56; k++) { const h = ctx.highs.at(-k); if (h == null) break; if (h > hh) hh = h; }
  let ll = Infinity;
  for (let k = 2; k <= 21; k++) { const l = ctx.lows.at(-k); if (l == null) break; if (l < ll) ll = l; }
  if (!isFinite(hh) || !isFinite(ll)) return null;

  const up = close1 > sma200;
  const longStop = ctx.entryPx != null ? ctx.entryPx - 3 * atr : null;
  const shortStop = ctx.entryPx != null ? ctx.entryPx + 3 * atr : null;
  // 2x notional: enough to matter, small enough that a 3xATR stop (~15-20%) cannot wipe the account.
  const notional = ctx.cash * 2;

  if (ctx.position === 0) {
    ctx.watch([
      { side: 'buy', price: hh, trigger: 'above', note: '55h breakout long', conds: [{ label: 'price>SMA200', ok: up }] },
      { side: 'sell', price: ll, trigger: 'below', note: '55l breakout short', conds: [{ label: 'price<SMA200', ok: !up }] }
    ]);
    if (up && ctx.price > hh) return { side: 'buy', qty: notional / ctx.price };
    if (!up && ctx.price < ll) return { side: 'sell', qty: notional / ctx.price };
    return null;
  }

  if (ctx.position > 0) {
    const watchArr = [{ side: 'sell', price: ll, trigger: 'below', note: '20l exit long' }];
    if (longStop != null) watchArr.push({ side: 'sell', price: longStop, trigger: 'below', note: '3xATR stop long' });
    ctx.watch(watchArr);
    if (ctx.price < ll) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    if (longStop != null && ctx.price <= longStop) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    return null;
  }

  // Short position (ctx.position < 0): buy back to close.
  const watchArr = [{ side: 'buy', price: hh, trigger: 'above', note: '20h exit short' }];
  if (shortStop != null) watchArr.push({ side: 'buy', price: shortStop, trigger: 'above', note: '3xATR stop short' });
  ctx.watch(watchArr);
  if (ctx.price > hh) return { side: 'buy', qty: -ctx.position, reduceOnly: true };
  if (shortStop != null && ctx.price >= shortStop) return { side: 'buy', qty: -ctx.position, reduceOnly: true };
  return null;
}
