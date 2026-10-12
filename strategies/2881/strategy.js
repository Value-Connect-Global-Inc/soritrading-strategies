/*
 * @coinsori-strategy v1
 * name: Donchian Breakout BTC 1D
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: A classic price-channel (Donchian) trend strategy — the
 * "turtle" approach. When price breaks above the highest high of the last N
 * days, a new uptrend is usually starting; when it breaks below the lowest low,
 * the trend is over. This catches melt-ups earlier than slow moving-average or
 * volume gates, which is exactly where the OBV champion lags.
 * When it buys and sells: buys when today's price closes above the 55-day high;
 * sells when it closes below the 20-day low (a tighter exit lets winners ride
 * while cutting losers fast).
 * When it does NOT work: whipsaws badly in long sideways/choppy markets — price
 * repeatedly pokes above the channel then falls back, producing many small
 * losing trades. BTC's bear markets and range-bound years are the danger zone.
 */
function onUpdate(ctx) {
  const pos = ctx.position;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const ENTRY = 55;   // 55-day high for entry
  const EXIT = 20;    // 20-day low for exit
  const closes = ctx.closes;
  if (!closes || closes.length < ENTRY + 2) return null;

  // Entry uses the high of the past ENTRY days (excluding today)
  const hi = ctx.high(ENTRY, 1);
  // Exit uses the low of the past EXIT days (excluding today)
  const lo = ctx.low(EXIT, 1);
  if (hi == null || lo == null) return null;

  const st = ctx.state;
  let cd = st.cd || 0;
  if (cd > 0) cd--;
  ctx.state.cd = cd;

  if (pos > 0) {
    // Exit when price closes below the 20-day low
    if (price < lo && cd === 0) {
      ctx.state.cd = 3;
      return { side: 'sell', qty: pos };
    }
    // Display: waiting for exit below 20-day low
    ctx.watch([{ side: 'sell', price: lo, trigger: 'below', note: '20-day low exit' }]);
    return null;
  }

  // Enter when price closes above the 55-day high
  if (price > hi && cd === 0) {
    ctx.state.cd = 3;
    const qty = ctx.cash / price * 0.95;
    return { side: 'buy', qty: qty };
  }
  // Display: waiting for entry above 55-day high
  ctx.watch([{ side: 'buy', price: hi, trigger: 'above', note: '55-day high entry' }]);
  return null;
}
