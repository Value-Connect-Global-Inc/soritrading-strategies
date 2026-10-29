/*
 * @coinsori-strategy v1
 * name: BTC SMA200 Trend + Deep-DD Stop 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The champion (SMA200 + vol-target) rides down through
 * crashes to a ~50% drawdown because it only exits on the slow 200-day average.
 * A tight ATR trailing stop added whipsaw (tested, failed). Instead this variant
 * adds ONE deep safety stop: if the position loses 35% from its peak, exit
 * immediately. 35% is deep enough that normal corrections never hit it, but a
 * true crash (2018, 2022) does. The slow 200-day exit stays as the normal exit.
 * When it buys and sells: Buys when the previous close is above SMA200, sized by
 * vol-target. Sells when close falls below SMA200, OR when the position is down
 * 35% from its running peak. No cooldown — re-enters normally when close is back
 * above SMA200.
 * When it does NOT work: A slow grinding bear that never reaches a 35% single-leg
 * drop still rides down to the 200-day exit. A crash that drops 35% in one move
 * sells near the bottom and can miss the rebound. The 35% threshold is a
 * judgement call — shallower catches more but whipsaws more.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const sma200 = ctx.sma(200, 1);
  const atr20 = ctx.atr(20, 1);
  if (sma200 == null || atr20 == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const pos = ctx.position;
  const st = ctx.state;

  if (pos > 0) {
    // track running peak while holding (survives restarts)
    const peak = (st.peak && st.peak > price) ? st.peak : price;
    ctx.state = { ...st, peak: peak };
    // deep safety stop: only a true crash (35% off peak) triggers it
    const ddStop = peak * 0.65;

    ctx.watch([
      { side: 'sell', price: ddStop, trigger: 'below', note: '35% peak drawdown stop' },
      { side: 'sell', price: sma200, trigger: 'below', note: 'below SMA200' }
    ]);

    if (prevClose < ddStop) {
      ctx.state = { ...ctx.state, peak: null };
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    if (prevClose < sma200) {
      ctx.state = { ...ctx.state, peak: null };
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  if (ctx.alloc && ctx.alloc.status !== 'ok') return null;

  if (prevClose > sma200) {
    // same vol-target sizing as the champion
    const atrPct = atr20 / price;
    const frac = Math.min(1, 0.03 / atrPct);
    const qty = (0.99 * ctx.cash * frac) / price * 0.99;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
