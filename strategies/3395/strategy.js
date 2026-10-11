/*
 * @coinsori-strategy v1
 * name: ADA Donchian 55/10 BearSized Cool10 1D
 * ex: binance
 * syms: ADAUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The ADA Donchian 55/10 champion loses in whipsaw regimes where a failed breakout
 * is followed quickly by another failed breakout. After a stop-out the champion pauses only 3 bars
 * before re-entering; this variant pauses 10 bars. A-priori reason: whipsaw losses come in clusters,
 * and a longer pause after a loss skips the next failed breakout while still catching a genuine trend
 * (which has a durable breakout, not an immediate retest). Same entry/exit rules otherwise.
 * When it buys and sells: Buys on 55-bar high breakout, unless within 10 bars of a stop-out. Sells
 * on 10-bar low close. Regime sizing unchanged (1.0/0.5/0.25).
 * When it does NOT work: In a strong trend that reverses then immediately re-breaks out, the longer
 * pause skips the re-entry. Also still loses in a long range.
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
    if (prevClose < sma200) sizeMult = 0.5;             // mild bear: half size
    if (prevClose < sma200 * 0.8) sizeMult = 0.25;      // deep bear: quarter size
  }

  const pos = ctx.position;

  if (pos > 0) {
    const entry = ctx.entryPx || price;
    const channelLow = Math.min(...closes.slice(-12, -2));
    const exited = prevClose < channelLow || price < entry - 2 * atr;
    ctx.watch([{ side: 'sell', price: entry - 2 * atr, trigger: 'below', note: '2 ATR stop' }]);
    if (exited) {
      ctx.state.coolUntil = ctx.i + 10;                 // longer pause: skip next failed breakout after a whipsaw
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  const channelHigh = Math.max(...closes.slice(-57, -2));
  const breakout = prevClose > channelHigh;
  if (breakout && ctx.i >= (ctx.state.coolUntil || 0)) {
    ctx.watch([{ side: 'sell', price: price - 2 * atr, trigger: 'below', note: '2 ATR stop' }]);
    return { side: 'buy', qty: ((ctx.cash / price) * 0.99 * sizeMult) };
  }
  return null;
}
