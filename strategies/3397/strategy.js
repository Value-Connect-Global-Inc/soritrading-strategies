/*
 * @coinsori-strategy v1
 * name: ADA Donchian 55/10-20 BearSized Cool10 RegimeExit 1D
 * ex: binance
 * syms: ADAUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The ADA Donchian 55/10 champion's exit channel is 10 bars. Testing wider exit
 * channels showed a clean regime trade-off: 20-bar exit captured the 2018-21 bull far better
 * (+1788 vs +1148, MDD 29.7 vs 34.5) but lost more in the choppy 2021-24 window (+60 vs +98, MDD
 * 38.6 vs 28.1). The position sizing already adapts to the 200-day trend regime, so this version
 * makes the EXIT channel adapt the same way: use the wide 20-bar exit when price is above the
 * 200-day average (bull regime, trends persist — let winners run), and the narrow 10-bar exit when
 * price is below it (bear/choppy regime — cut losses fast). A-priori reason: above the long-term
 * trend breakouts persist, below it they whipsaw. Entry, sizing and cooldown unchanged.
 * When it buys and sells: Buys when a closed bar closes above the highest 55 bars, unless within
 * 10 bars of a stop-out. Sells when a closed bar closes below the lowest 20 bars if above the
 * 200-day average, else the lowest 10 bars. Position is half size below the 200-day average,
 * quarter size when more than 20% below it.
 * When it does NOT work: A bull regime that turns into an extended distribution gives back more via
 * the wide exit before the price falls below the 200-day average. A long range still loses, just
 * less. A violent crash gaps through any stop.
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
  let exitBars = 10;
  if (sma200 != null) {
    if (prevClose < sma200) sizeMult = 0.5;             // mild bear: half size
    if (prevClose < sma200 * 0.8) sizeMult = 0.25;      // deep bear (>20% below trend): quarter size
    if (prevClose >= sma200) exitBars = 20;             // bull regime: wide exit lets trends run
  }

  const pos = ctx.position;

  if (pos > 0) {
    const entry = ctx.entryPx || price;
    const channelLow = Math.min(...closes.slice(-(exitBars + 2), -2));
    const exited = prevClose < channelLow || price < entry - 2 * atr;
    ctx.watch([{ side: 'sell', price: entry - 2 * atr, trigger: 'below', note: '2 ATR stop' }]);
    if (exited) {
      ctx.state.coolUntil = ctx.i + 10;                 // longer pause: skip the next failed breakout after a whipsaw
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
