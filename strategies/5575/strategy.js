/*
 * @coinsori-strategy v1
 * name: BTC Calm-Trend Regime 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin's durable up-moves happen when the trend is up AND
 * equity volatility is calm (risk-on). Buying a rising trend while the VIX is
 * spiking (panic) tends to fail, so this system holds BTC only when both are true.
 * It overlays the real CBOE VIX (FRED data, 2-day lag) as a regime filter on a
 * classic 50/200 moving-average trend.
 * When it buys and sells: Buys when the 50d EMA is above the 200d SMA, price is
 * above the 200d SMA, and the VIX is below 30 (calm). Sells on the 50/200 death
 * cross or a 3xATR trailing stop from the highest close since entry.
 * When it does NOT work: If VIX stays above 30 for months while BTC trends up, it
 * misses the move (sustained fear during a crypto rally). It also whipsaws in
 * sideways markets and, like all trend systems, lags buy-and-hold in clean bulls.
 */
function onUpdate(ctx) {
  const closes = ctx.closes;
  if (closes == null || closes.length < 210) return null;

  const pos = ctx.position;
  const price = ctx.price;
  if (price == null || price <= 0) return null;

  // Closed-bar indicators: 50d EMA, 200d SMA, ATR for the trailing stop.
  const ema50 = ctx.ema(50, 1);
  const sma200 = ctx.sma(200, 1);
  const atr = ctx.atr(14, 1);
  if (ema50 == null || sma200 == null || atr == null || atr <= 0) return null;

  const prevClose = closes.at(-2);
  const ema50Prev = ctx.ema(50, 2);
  const sma200Prev = ctx.sma(200, 2);

  if (pos != null && pos > 0) {
    // Trailing stop: exit if price closes below (highest close since entry - 3*ATR).
    let st = ctx.state || {};
    if (typeof st.hi !== 'number') st.hi = prevClose;
    if (prevClose > st.hi) st.hi = prevClose;
    ctx.state = st;
    const trailStop = st.hi - 3 * atr;
    // Death cross: exit when 50d EMA crosses below 200d SMA.
    const deathCross = ema50Prev != null && sma200Prev != null && ema50Prev > sma200Prev && ema50 <= sma200;
    if (deathCross || prevClose < trailStop) {
      ctx.watch([{ side: 'sell', price: trailStop, trigger: 'below', note: 'trail stop 3xATR' },
                 { side: 'sell', note: 'death cross' }]);
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  // Regime entry (level-based, not a single-bar event so a VIX spike cannot
  // permanently block a valid entry): trend up AND price above 200d AND VIX calm.
  const trendUp = ema50Prev != null && sma200Prev != null && ema50Prev > sma200Prev && prevClose > sma200Prev;
  if (trendUp) {
    const vix = ctx.data('base_vix');
    if (vix == null) return null; // VIX unknown -> cannot confirm calm regime
    if (vix >= 30) {
      // 30 is the standard 'panic' line for the VIX; stay out while fear is high.
      ctx.watch([{ side: 'buy', note: 'trend up, waiting for calm VIX', conds: [{ label: 'VIX < 30', now: vix, op: '<', ref: 30, closed: true }] }]);
      return null;
    }
    if (ctx.alloc.status !== 'ok') return null; // reduce-only edge, no new entries
    // Reset the trailing-stop high for the new position (never inherit the old one).
    ctx.state = { hi: prevClose };
    const qty = (ctx.cash / price) * 0.99;
    if (qty <= 0) return null;
    ctx.watch([{ side: 'buy', note: 'trend up + VIX calm' }]);
    return { side: 'buy', qty: qty };
  }
  return null;
}
