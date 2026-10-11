/*
 * @coinsori-strategy v1
 * name: ADA Donchian 55/10 BearSized Cool5 1D
 * ex: binance
 * syms: ADAUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Cool-down axis tuning — champion pauses 3 bars after a stop-out, Cool10 pauses
 * 10 and improved both dev windows (lower MDD both, higher return on W2). This tests 5 to see the
 * shape of the response. Same entry/exit rules otherwise.
 * When it buys and sells: Buys on 55-bar high breakout, unless within 5 bars of a stop-out. Sells
 * on 10-bar low close. Regime sizing unchanged.
 * When it does NOT work: In a strong trend that reverses then immediately re-breaks out, the pause
 * skips the re-entry.
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
    const channelLow = Math.min(...closes.slice(-12, -2));
    const exited = prevClose < channelLow || price < entry - 2 * atr;
    ctx.watch([{ side: 'sell', price: entry - 2 * atr, trigger: 'below', note: '2 ATR stop' }]);
    if (exited) {
      ctx.state.coolUntil = ctx.i + 5;                  // medium pause
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
