/*
 * @coinsori-strategy v1
 * name: ADA Donchian 55/10 Stop0.5 Diagnostic 1D
 * ex: binance
 * syms: ADAUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Diagnostic variant — deliberately absurd 0.5x ATR stop to prove whether the
 * ATR stop axis binds at all. If results are identical to the champion, the 10-bar channel exit
 * always fires first and the stop is a no-op (then this axis is abandoned). If results differ,
 * the stop does bind and a tighter stop changes behavior.
 * When it buys and sells: Buys on 55-bar high breakout. Sells on 10-bar low close or a very tight
 * 0.5x ATR stop. Regime sizing unchanged (1.0/0.5/0.25).
 * When it does NOT work: Diagnostic only — not for real use.
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
  let sizeMult = 1.0;
  if (sma200 != null) {
    if (prevClose < sma200) sizeMult = 0.5;
    if (prevClose < sma200 * 0.8) sizeMult = 0.25;
  }

  const pos = ctx.position;

  if (pos > 0) {
    const entry = ctx.entryPx || price;
    const stop = entry - 0.5 * atr;                     // diagnostic absurdly tight stop
    const channelLow = Math.min(...closes.slice(-12, -2));
    const exited = prevClose < channelLow || price < stop;
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '0.5 ATR stop' }]);
    if (exited) {
      ctx.state.coolUntil = ctx.i + 3;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  const channelHigh = Math.max(...closes.slice(-57, -2));
  const breakout = prevClose > channelHigh;
  if (breakout && ctx.i >= (ctx.state.coolUntil || 0)) {
    ctx.watch([{ side: 'sell', price: price - 0.5 * atr, trigger: 'below', note: '0.5 ATR stop' }]);
    return { side: 'buy', qty: ((ctx.cash / price) * 0.99 * sizeMult) };
  }
  return null;
}
