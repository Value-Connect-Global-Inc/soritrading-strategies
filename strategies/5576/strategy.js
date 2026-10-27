/*
 * @coinsori-strategy v1
 * name: BTC GoldenCross VIX-Latch 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin's biggest moves are long trends, and those trends
 * mostly run when equity volatility is calm. This is the classic 50/200 golden
 * cross trend system, but a real CBOE VIX reading (FRED, 2-day lag) acts as a
 * panic filter: a fresh trend-up signal is latched, and the entry is taken only
 * once the VIX is back below 30 — so a fear spike delays the entry instead of
 * cancelling it, and if the trend dies before fear calms, the signal is dropped.
 * When it buys and sells: Buys BTC when the 50d EMA crosses above the 200d SMA
 * (closed bars) and price is above the 200d SMA, once the VIX is below 30. Sells
 * on the death cross or a 3xATR trailing stop from the highest close since entry.
 * When it does NOT work: If VIX stays above 30 for months while BTC trends up it
 * misses the move; it also whipsaws in sideways markets and lags buy-and-hold in
 * clean bull runs (late entry, early exit).
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

  let st = ctx.state || {};
  if (typeof st.hi !== 'number') st.hi = prevClose;

  if (pos != null && pos > 0) {
    // Trailing stop: exit if price closes below (highest close since entry - 3*ATR).
    if (prevClose > st.hi) st.hi = prevClose;
    ctx.state = st;
    const trailStop = st.hi - 3 * atr;
    // Death cross: exit when 50d EMA crosses below 200d SMA.
    const deathCross = ema50Prev != null && sma200Prev != null && ema50Prev > sma200Prev && ema50 <= sma200;
    if (deathCross || prevClose < trailStop) {
      ctx.watch([{ side: 'sell', price: trailStop, trigger: 'below', note: 'trail stop 3xATR' },
                 { side: 'sell', note: 'death cross' }]);
      // Clear the latch and reset the high so the next entry starts clean.
      ctx.state = { hi: prevClose };
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  // Flat: latch a fresh golden cross, enter once VIX is calm.
  // trendUp uses the CURRENT ema50>sma200 (true right after a cross) so the latch
  // is not cancelled on the very bar it fires.
  const trendUp = ema50 != null && sma200 != null && ema50 > sma200 && prevClose > sma200;
  const goldenCross = ema50Prev != null && sma200Prev != null && ema50Prev <= sma200Prev && ema50 > sma200;
  const vix = ctx.data('base_vix');

  // A fresh trend-up signal is latched even if VIX is spiking that day.
  if (goldenCross) st.pending = true;
  // If the trend dies before VIX calms, drop the signal.
  if (st.pending && !trendUp) st.pending = false;

  if (st.pending && trendUp && vix != null && vix < 30) {
    // 30 is the standard 'panic' line for the VIX; only enter in a calm regime.
    if (ctx.alloc.status !== 'ok') return null; // reduce-only edge, no new entries
    st.pending = false;
    ctx.state = { hi: prevClose };
    const qty = (ctx.cash / price) * 0.99;
    if (qty <= 0) return null;
    ctx.watch([{ side: 'buy', note: 'golden cross + VIX calm' }]);
    return { side: 'buy', qty: qty };
  }

  if (st.pending) {
    ctx.watch([{ side: 'buy', note: 'trend up, waiting for calm VIX', conds: [{ label: 'VIX < 30', now: vix, op: '<', ref: 30, closed: true }] }]);
  }
  ctx.state = st;
  return null;
}
