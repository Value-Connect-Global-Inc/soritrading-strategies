/*
 * @coinsori-strategy v1
 * name: ADA Donchian 55/10 BearSized Stop1.5 1D
 * ex: binance
 * syms: ADAUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The ADA Donchian 55/10 champion beats buy-and-hold on all three 1d windows,
 * but its worst losses come from breakout whipsaws in bear regimes. The champion's exit stop has
 * been fixed at 2x ATR since the start; this variant tightens it to 1.5x ATR so that a reversing
 * breakout is cut sooner and costs less. Size stays regime-adaptive (full above 200-day average,
 * half below, quarter when more than 20% below).
 * When it buys and sells: Buys when a closed bar closes above the highest 55 bars. Sells when a
 * closed bar closes below the lowest 10 bars, or price falls 1.5x ATR below entry. Position is
 * half size while price is below the 200-day average, quarter size when more than 20% below it.
 * When it does NOT work: In a long range where every breakout is a trap it still loses, just less.
 * A violent crash gaps through the stop regardless of size. Tighter stop also exits winners early
 * in a slow grind-up.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const closes = ctx.closes;
  const n = closes.length;
  if (n < 60) return null;

  const prevClose = closes.at(-2);
  if (prevClose == null) return null;

  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0) return null;

  const sma200 = ctx.sma(200, 1);
  // Size tiers by how far below the 200-day trend price is. Deeper = stronger downtrend = bet less.
  let sizeMult = 1.0;
  if (sma200 != null) {
    if (prevClose < sma200) sizeMult = 0.5;             // mild bear: half size
    if (prevClose < sma200 * 0.8) sizeMult = 0.25;      // deep bear (>20% below trend): quarter size
  }

  const pos = ctx.position;

  if (pos > 0) {
    const entry = ctx.entryPx || price;
    const stop = entry - 1.5 * atr;                     // tighter stop: cut reversing breakouts sooner
    const channelLow = Math.min(...closes.slice(-12, -2));
    const exited = prevClose < channelLow || price < stop;
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '1.5 ATR stop' }]);
    if (exited) {
      ctx.state.coolUntil = ctx.i + 3;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  const channelHigh = Math.max(...closes.slice(-57, -2));
  const breakout = prevClose > channelHigh;
  if (breakout && ctx.i >= (ctx.state.coolUntil || 0)) {
    ctx.watch([{ side: 'sell', price: price - 1.5 * atr, trigger: 'below', note: '1.5 ATR stop' }]);
    return { side: 'buy', qty: ((ctx.cash / price) * 0.99 * sizeMult) };
  }
  return null;
}
