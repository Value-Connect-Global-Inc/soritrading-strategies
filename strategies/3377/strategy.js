/*
 * @coinsori-strategy v1
 * name: SOL Volume-Confirmed Breakout 1D
 * ex: binance
 * syms: SOLUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: A breakout is only meaningful when real money pushes it. A close above
 * the 30-day high that comes with above-average volume is far more likely to sustain than a
 * quiet drift through the range — volume confirms the move. SOL is the highest-beta major,
 * so its confirmed breakouts tend to run furthest. This is the opposite family to the RSI2
 * panic basket: that one buys crashes, this one buys strength.
 * When it buys and sells: It buys when the previous closed bar makes a new 30-day high on
 * volume at least 1.2x its 30-day average, while price is still above its 100-day trend.
 * It rides the trend with a 3x-ATR trailing stop below the highest close since entry, and
 * also sells if the 100-day trend breaks. A 25% disaster stop caps the worst case.
 * When it does NOT work: In a long chop where every high-volume push is a bull trap it gets
 * whipsawed and pays fees. In a slow grind up with shrinking volume (no confirmation) it
 * stays out and misses the move. A violent crash gaps through the trailing stop.
 */

function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const closes = ctx.closes;
  const vols = ctx.volumes;
  const n = closes.length;
  if (n < 110) return null; // need 100d trend + 30d range + warmup

  // Work on CLOSED bars only (ago>=1) — identical in backtest, paper and live.
  const prevClose = closes.at(-2);
  const prevVol = vols.at(-2);
  if (prevClose == null || prevVol == null) return null;

  const ema100 = ctx.ema(100, 1);
  const atr = ctx.atr(14, 1);
  if (ema100 == null || atr == null || atr <= 0) return null;

  // 30-day range high EXCLUDING the current closed bar (slice end -2, so prevClose is not in it).
  const rangeHigh = Math.max(...closes.slice(-32, -2));
  // 30-day average volume of the CLOSED bars before the current one.
  const avgVol = vols.slice(-32, -2).reduce((a, b) => a + b, 0) / 30;

  const s = ctx.state.s || (ctx.state.s = {});
  const pos = ctx.position;

  if (pos > 0) {
    // Trail the highest CLOSED close since entry; exit on a 3x ATR pullback from it.
    if (prevClose > s.high) s.high = prevClose;
    const trail = s.high - 3 * atr;
    const trendBreak = prevClose < ema100;
    const disaster = price <= (ctx.entryPx || price) * 0.75;
    ctx.watch([
      { side: 'sell', price: trail, trigger: 'below', note: '3x ATR trail' },
      { side: 'sell', price: ema100, trigger: 'below', note: '100d trend' }
    ]);
    if (disaster || trendBreak || prevClose < trail) {
      s.coolUntil = ctx.i + 5; // cooldown so a whipsaw rebound does not re-enter instantly
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  // ENTRY: new 30-day high on the closed bar + volume 1.2x average + above 100d trend.
  // Volume threshold 1.2x: a 20% surge is enough to confirm — grind-up bulls break out on
  // modestly elevated volume, not just panic surges (1.5x missed those).
  const breakout = prevClose > rangeHigh && prevVol > 1.2 * avgVol;
  const trendUp = prevClose > ema100;
  if (breakout && trendUp && ctx.i >= (s.coolUntil || 0)) {
    s.high = prevClose;
    ctx.watch([{ side: 'sell', price: prevClose - 3 * atr, trigger: 'below', note: '3x ATR trail' }]);
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  return null;
}
