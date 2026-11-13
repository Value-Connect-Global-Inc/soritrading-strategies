/*
 * @coinsori-strategy v1
 * name: BTC Regime Trail +EMA50Exit 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: the SMA50>SMA200 entry gate blocks bear-market re-entries, and a fast EMA50
 * exit cuts the give-back at regime tops: when price closes below its 8-day EMA we leave instead of
 * waiting for the 20-30% trailing stop, so a Nov-2021-style top drawdown is much smaller. Ride the
 * bull with a volatility-scaled trail (8x ATR bounded to 20-30%) as the backstop.
 * When it buys and sells: buys when price closes 2% above a RISING 200-bar SMA with SMA50 above it;
 * sells when price closes below EMA50, or 2% below the SMA, or drops the vol-scaled trail.
 * When it does NOT work: the EMA50 exit fires on ordinary bull pullbacks (more exits and fees, and we
 * must re-enter cleanly to keep the trend); sideways chop still whipsaws; a fast crash can still gap
 * through the trail.
 */
function onUpdate(ctx) {
  const REGIME_N = 200;    // ~33 days at 4h: bull/bear regime filter
  const FAST_N = 50;       // ~8 days at 4h: medium-term trend gate + fast exit MA
  const BAND = 0.02;       // hysteresis around the MA: skip shallow chop crossings (whipsaw killer)
  const TRAIL_MIN = 0.20;  // floor on the trail so calm-chop stops are not absurdly tight
  const TRAIL_MAX = 0.30;  // cap: bound worst-case give-back of any single position at regime tops
  const ATR_MULT = 8;      // trail = 8x ATR: wider than typical bull pullbacks in high vol
  const SLOPE_N = 20;      // ~3.3 days at 4h: MA must be rising over this window to allow a buy

  const ma = ctx.sma(REGIME_N, 1);
  const fastMa = ctx.sma(FAST_N, 1);
  const emaFast = ctx.ema(FAST_N, 1);
  const atr = ctx.atr(14, 1);
  if (ma == null || fastMa == null || emaFast == null || atr == null) { ctx.watch([]); return null; }

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
      { side: 'sell', price: bandPx, trigger: 'below', note: 'below MA band' },
      { side: 'sell', price: emaFast, trigger: 'below', note: 'below EMA50' }
    ]);
    if (price < trailPx || prevClose < bandPx || prevClose < emaFast) {
      return { side: 'sell', qty: ctx.position, reduceOnly: true };
    }
    return null;
  }

  // only buy into an ESTABLISHED uptrend: slow MA rising AND medium-term SMA above it
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
