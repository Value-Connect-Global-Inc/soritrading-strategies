/*
 * @coinsori-strategy v1
 * name: ADA Donchian 70/10 BearSized Cool10 1D
 * ex: binance
 * syms: ADAUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The ADA Donchian 55/10 champion's entry channel (55) is fixed since the start.
 * 40-bar entry was worse (W1 +710 vs +1148). This version tests a longer 70-bar entry channel.
 * A-priori reason: a 70-bar channel is broken only after a more sustained move, so entries are
 * later and rarer — fewer whipsaw losses but the strategy misses the early part of a trend.
 * Expected trade-off: lower return in strong trends, fewer false breakouts in ranges.
 * When it buys and sells: Buys when a closed bar closes above the highest 70 bars, unless within
 * 10 bars of a stop-out. Sells when a closed bar closes below the lowest 10 bars. Position is half
 * size below the 200-day average, quarter size when more than 20% below it.
 * When it does NOT work: A longer entry channel enters late, so a strong but short trend is mostly
 * missed. A violent crash gaps through any stop.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const closes = ctx.closes;
  const n = closes.length;
  if (n < 80) return null;

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

  const channelHigh = Math.max(...closes.slice(-72, -2));   // 70-bar entry channel
  const breakout = prevClose > channelHigh;
  if (breakout && ctx.i >= (ctx.state.coolUntil || 0)) {
    ctx.watch([{ side: 'sell', price: price - 2 * atr, trigger: 'below', note: '2 ATR stop' }]);
    return { side: 'buy', qty: ((ctx.cash / price) * 0.99 * sizeMult) };
  }
  return null;
}
