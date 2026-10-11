/*
 * @coinsori-strategy v1
 * name: ADA Donchian 55/10 BearSized Cool10 Str2 1D
 * ex: binance
 * syms: ADAUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The ADA Donchian 55/10 champion loses in ranges to whipsaw breakouts — a
 * close that barely pokes above the 55-bar high is usually a fake breakout, not a trend start.
 * This version adds a 2% breakout-strength filter: the close must clear the 55-bar high by a real
 * margin before buying. Real trends clear the channel with momentum; fake ones do not. All other
 * rules (10-bar exit, BearSized position tiers, 10-bar cooldown after a stop-out) are unchanged.
 * When it buys and sells: Buys when a closed bar closes at least 2% above the highest 55 bars,
 * unless within 10 bars of a stop-out. Sells when a closed bar closes below the lowest 10 bars.
 * Position is half size below the 200-day average, quarter size when more than 20% below it.
 * When it does NOT work: A genuine trend that starts with a small first push above the channel is
 * skipped until it is 2% clear, so it enters later (higher price, less gain). A long range still
 * loses, just less. A violent crash gaps through any stop.
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
    const channelLow = Math.min(...closes.slice(-12, -2));
    const exited = prevClose < channelLow || price < entry - 2 * atr;
    ctx.watch([{ side: 'sell', price: entry - 2 * atr, trigger: 'below', note: '2 ATR stop' }]);
    if (exited) {
      ctx.state.coolUntil = ctx.i + 10;                 // longer pause: skip the next failed breakout after a whipsaw
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  const channelHigh = Math.max(...closes.slice(-57, -2));
  // Breakout strength: close must clear the 55-bar high by 2%, not just poke above it.
  // Weak breakouts are the whipsaws that lose in ranges; real trends clear with momentum.
  const breakout = prevClose > channelHigh * 1.02;
  if (breakout && ctx.i >= (ctx.state.coolUntil || 0)) {
    ctx.watch([{ side: 'sell', price: price - 2 * atr, trigger: 'below', note: '2 ATR stop' }]);
    return { side: 'buy', qty: ((ctx.cash / price) * 0.99 * sizeMult) };
  }
  return null;
}
