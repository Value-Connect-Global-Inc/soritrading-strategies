/*
 * @coinsori-strategy v1
 * name: BTC 4h Trend Ride + Greed Filter + DeRisk
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Trend riding captures bull moves, but buying at the very top of a
 * euphoric spike (Fear & Greed >= 85) tends to be near a local top. Filtering only those
 * entries keeps most of the upside while avoiding the worst-fated longs. A volatility
 * de-risk (cut to 40% at 2.2x normal vol while the trend falls, restore under 1.5x) and a
 * -20% hard stop cap crash drawdowns that moving averages lag.
 * When it buys: EMA50 above EMA200 (uptrend) and Fear & Greed below 85.
 * When it sells: trend flips down, hard stop -20% below entry, or de-risk cut at high vol.
 * When it does NOT work: in a volatile chop where ATR stays at the extreme threshold it
 * holds at reduced size and gives up upside; a hard stop can be hit by a sharp intra-trend
 * shakeout and force a re-entry at a worse price.
 */
function onUpdate(ctx) {
  const e50 = ctx.ema(50, 1);
  const e200 = ctx.ema(200, 1);
  if (e50 == null || e200 == null) return null;
  const atrF = ctx.atr(14, 1);
  const atrS = ctx.atr(100, 1);
  if (atrF == null || atrS == null) return null;
  const e50Prev = ctx.ema(50, 6);
  if (e50Prev == null) return null;
  const fg = ctx.data('fear_greed');
  if (fg == null) return null;

  const price = ctx.price;
  const up = e50 > e200;
  const inPos = ctx.position > 0;
  const ratio = atrF / atrS;
  const falling = e50 < e50Prev;
  const deRisked = ctx.state.deRisked === true;
  const shouldDeRisk = ratio >= 2.2 && falling;
  const shouldRestore = ratio <= 1.5;
  const stop = ctx.entryPx != null ? ctx.entryPx * 0.8 : 0;
  const equity = ctx.cash + ctx.position * price;

  ctx.watch([
    { side:'buy', price: e200, trigger:'above', note:'uptrend, not euphoric', conds:[{label:'F&G', now: fg, op:'<', ref: 85, closed:true}] },
    ...(inPos ? [
      { side:'sell', price: e200, trigger:'below', note:'trend broke' },
      { side:'sell', price: stop, trigger:'below', note:'hard stop' }
    ] : [])
  ]);

  if (inPos && ctx.entryPx != null) {
    if (price <= stop) { ctx.state.deRisked = false; return { side:'sell', qty: ctx.position, reduceOnly: true }; }
    if (!up) { ctx.state.deRisked = false; return { side:'sell', qty: ctx.position, reduceOnly: true }; }
    if (!deRisked && shouldDeRisk) {
      ctx.state.deRisked = true;
      const diff = ctx.position - (equity / price) * 0.4;
      if (diff > (equity / price) * 0.05) return { side:'sell', qty: diff * 0.99, reduceOnly: true };
    } else if (deRisked && shouldRestore) {
      ctx.state.deRisked = false;
      const diff = (equity / price) * 0.99 - ctx.position;
      if (diff > (equity / price) * 0.05) return { side:'buy', qty: diff * 0.99 };
    }
    return null;
  }
  if (up && fg < 85) {
    const qty = deRisked ? (equity / price) * 0.4 : (equity / price) * 0.99;
    return { side:'buy', qty: qty };
  }
  return null;
}
