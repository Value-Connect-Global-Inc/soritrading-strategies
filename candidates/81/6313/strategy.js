/*
 * @coinsori-strategy v1
 * name: BTC Donchian Breakout 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: BTC makes long, strong trends on the 4h chart. Buying a break above the
 * highest high of the last 55 bars catches the start of those trends, and a 20-bar trailing exit
 * keeps us riding them while a hard stop caps any single loss.
 * When it buys and sells: buys when the close breaks above the 55-bar high; sells when the close
 * breaks below the 20-bar low, or when price falls 2.5 ATR below our entry (hard stop).
 * When it does NOT work: in long sideways chop with no real trends the breakout whipsaws and the
 * trailing exit cuts many small losses. It is long-only, so it also misses persistent
 * bear-market profits.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (price == null) return null;

  // ago=2: the 55 highs / 20 lows BEFORE the last closed bar, so a breakout of that bar is real.
  const hi55 = ctx.high(55, 2);
  const lo20 = ctx.low(20, 2);
  const atr = ctx.atr(14, 1);
  if (hi55 == null || lo20 == null || atr == null) return null;

  const pos = ctx.position || 0;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  // Hard stop sits 2.5 ATR below entry; only meaningful while holding.
  let stopPx = null;
  if (pos > 0 && ctx.entryPx != null) {
    stopPx = ctx.entryPx - 2.5 * atr;
  }

  ctx.watch([
    { side: 'buy', price: hi55, trigger: 'above', note: '55-bar breakout entry' },
    { side: 'sell', price: lo20, trigger: 'below', note: '20-bar trailing exit' },
    ...(stopPx != null ? [{ side: 'sell', price: stopPx, trigger: 'below', note: '2.5 ATR hard stop' }] : [])
  ]);

  // Exit first: trailing stop or hard stop.
  if (pos > 0) {
    if (prevClose < lo20) return { side: 'sell', qty: pos, reduceOnly: true };
    if (stopPx != null && prevClose < stopPx) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }

  // Entry on 55-bar breakout, sized so a 2.5 ATR stop loses ~1.5% of equity.
  if (prevClose > hi55) {
    const stopDist = 2.5 * atr;
    const qtyByRisk = (0.015 * ctx.cash) / stopDist;
    const qtyByCash = (ctx.cash / price) * 0.98;
    return { side: 'buy', qty: Math.min(qtyByRisk, qtyByCash) };
  }
  return null;
}
