/*
 * @coinsori-strategy v1
 * name: BNB Donchian 55/10 BearSized 1D
 * ex: binance
 * syms: BNBUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The ADA Donchian 55/10 BearSized recipe is the validated champion of
 * this job — it beats buy-and-hold on all three 1d windows. This is the same recipe applied
 * to BNB (a large-cap with long history) to give the user a second asset with the same
 * proven behaviour: breakout entry, channel + ATR stop exit, and smaller positions in
 * bear regimes so whipsaws cost less.
 * When it buys and sells: Buys when a closed daily bar closes above the highest 55 bars.
 * Sells when a closed bar closes below the lowest 10 bars or price falls 2x ATR below entry.
 * Half size while price is below its 200-day average, quarter size when more than 20% below.
 * When it does NOT work: In a long range where every breakout is a trap it still loses, just
 * less. A violent crash gaps through the ATR stop regardless of size.
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
    if (prevClose < sma200 * 0.8) sizeMult = 0.25;      // deep bear (>20% below trend): quarter size
  }

  const pos = ctx.position;
  if (pos > 0) {
    const entry = ctx.entryPx || price;
    const stop = entry - 2 * atr;
    const channelLow = Math.min(...closes.slice(-12, -2));
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '2 ATR stop' }]);
    if (prevClose < channelLow || price < stop) {
      ctx.state.coolUntil = ctx.i + 3;
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
