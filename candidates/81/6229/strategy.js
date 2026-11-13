/*
 * @coinsori-strategy v1
 * name: BTC SMA100 Regime Filter 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: BTC's gains and losses cluster around its long-term average. Being invested
 * only when price is above a RISING 100-day SMA keeps us in during bull phases and steps aside in
 * bear phases — most of the upside with a much smaller drawdown than holding.
 * When it buys and sells: buys when the last closed price is 2% above a rising 100-day SMA; sells
 * when price closes 2% below the SMA (hysteresis skips noise), or on a 40% catastrophe stop from entry.
 * When it does NOT work: sideways chop around the SMA whipsaws; a sudden crash can gap through the
 * exit; the exit lags a fast top so we give back part of prior gains.
 */
function onUpdate(ctx) {
  const REGIME_N = 100;   // 100d SMA: faster re-entry after a dip than 200d, fewer missed rallies
  const SLOPE_N = 15;     // SMA must be rising over ~2 weeks to allow a buy
  const BAND = 0.02;      // hysteresis: skip tiny noise crossings both ways
  const HARD_STOP = 0.40; // catastrophe insurance only; 1d BTC bull corrections rarely exceed 40%

  const ma = ctx.sma(REGIME_N, 1);
  if (ma == null) { ctx.watch([]); return null; }
  const prevClose = ctx.closes.at(-2);
  const price = ctx.price;
  const st = ctx.state;

  if (ctx.position > 0) {
    const entry = ctx.entryPx;
    const stopPx = entry != null ? entry * (1 - HARD_STOP) : 0;
    ctx.watch([
      { side: 'sell', price: ma * (1 - BAND), trigger: 'below', note: 'regime flip band' },
      { side: 'sell', price: stopPx, trigger: 'below', note: 'hard stop' }
    ]);
    if (prevClose < ma * (1 - BAND) || (stopPx > 0 && price < stopPx)) {
      return { side: 'sell', qty: ctx.position, reduceOnly: true };
    }
    return null;
  }

  const maPrev = ctx.sma(REGIME_N, SLOPE_N);
  const rising = maPrev != null && ma > maPrev;
  const ok = prevClose > ma * (1 + BAND) && rising;
  ctx.watch([{ side: 'buy', price: ma * (1 + BAND), trigger: 'above', note: 'above rising SMA100' }]);
  if (ok) {
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.98 };
  }
  return null;
}
