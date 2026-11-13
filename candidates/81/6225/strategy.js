/*
 * @coinsori-strategy v1
 * name: BTC Regime + VolTrail 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: BTC spends most of its time trending. A slow 33-day (200-bar) SMA separates bull
 * regimes (price above) from bear regimes (price below). We ride the bull with a trailing stop whose
 * width scales with volatility (8x ATR(14), floored at 20% and capped at 30%): in high-vol bull runs
 * the trail is wider than the typical 20-35% pullback, so we keep most of the trend, but the cap bounds
 * how much any single position can give back at a regime top. We only enter when the SMA itself is
 * rising (no dead-cat bounces inside a downtrend) AND the medium-term trend agrees (SMA50 above SMA200,
 * which blocks bear-market rallies like Dec 2021 - mid 2022 from triggering re-entry). A +/-2% hysteresis
 * band around the MA kills the whipsaw that a plain MA cross causes.
 * When it buys and sells: buys when price closes 2% above a RISING 200-bar SMA while SMA50 is also above
 * it; sells when price closes 2% below the SMA OR drops the volatility-scaled trail % (20-30%) from the
 * highest close since entry.
 * When it does NOT work: a sideways chop that repeatedly crosses the band still whipsaws (fewer times
 * than a plain cross, but it still pays fees). The rising-MA + SMA50 gates make us late to re-enter right
 * after a V-shaped bottom, so we miss the first leg of a recovery. The trail still gives back up to 30%
 * of a fast crash before the stop fires.
 */
function onUpdate(ctx) {
  const REGIME_N = 200;    // ~33 days at 4h: bull/bear regime filter
  const FAST_N = 50;       // ~8 days at 4h: medium-term trend must agree before buying
  const BAND = 0.02;       // hysteresis around the MA: skip shallow chop crossings (whipsaw killer)
  const TRAIL_MIN = 0.20;  // floor on the trail so calm-chop stops are not absurdly tight
  const TRAIL_MAX = 0.30;  // cap: bound worst-case give-back of any single position at regime tops
  const ATR_MULT = 8;      // trail = 8x ATR: wider than typical bull pullbacks in high vol
  const SLOPE_N = 20;      // ~3.3 days at 4h: MA must be rising over this window to allow a buy

  const ma = ctx.sma(REGIME_N, 1);
  const fastMa = ctx.sma(FAST_N, 1);
  const atr = ctx.atr(14, 1);
  if (ma == null || fastMa == null || atr == null) { ctx.watch([]); return null; }

  const prevClose = ctx.closes.at(-2);  // last CLOSED bar (identical backtest/live)
  const price = ctx.price;
  const st = ctx.state;

  // trail width scales with realized volatility, bounded [20%, 30%]
  const trailPct = Math.min(TRAIL_MAX, Math.max(TRAIL_MIN, ATR_MULT * atr / price));

  if (ctx.position > 0) {
    // ratchet the trail to the highest closed price since entry
    if (st.hi == null || prevClose > st.hi) st.hi = prevClose;
    const trailPx = st.hi * (1 - trailPct);
    const bandPx = ma * (1 - BAND);
    ctx.watch([
      { side: 'sell', price: trailPx, trigger: 'below', note: 'vol trail stop' },
      { side: 'sell', price: bandPx, trigger: 'below', note: 'below MA band' }
    ]);
    if (price < trailPx || prevClose < bandPx) {
      return { side: 'sell', qty: ctx.position, reduceOnly: true };
    }
    return null;
  }

  // only buy into an ESTABLISHED uptrend: slow MA rising AND medium-term MA above it
  const maPrev = ctx.sma(REGIME_N, SLOPE_N);
  const slowRising = maPrev != null && ma > maPrev;
  const mediumUp = fastMa > ma;   // SMA50 above SMA200: blocks bear-market rallies
  const ok = prevClose > ma * (1 + BAND) && slowRising && mediumUp;
  ctx.watch([{ side: 'buy', price: ma * (1 + BAND), trigger: 'above', note: 'rising MA band' }]);
  if (ok) {
    st.hi = price;
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.98 };
  }
  return null;
}
