/*
 * @coinsori-strategy v1
 * name: BTC Golden-Cross Trend 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin's biggest, most repeatable moves are long trends — bull
 * runs last months and bear markets last months. A classic trend-following system
 * (buy when the fast average is above the slow average, sell when it flips) catches
 * the middle of these trends and sits in cash during the chop. An ATR trailing stop
 * protects the profit while a trend is running and locks in the exit when it ends.
 * When it buys and sells: It buys BTC when the 50-day EMA crosses above the 200-day
 * SMA (golden cross, on closed bars) and price is above the 200-day SMA. It sells
 * when the 50-day EMA crosses back below the 200-day SMA, or when price falls more
 * than 3x ATR below the highest close since entry (trailing stop).
 * When it does NOT work: Trend-following whipsaws in sideways markets — the averages
 * cross back and forth and each cross costs fees. It enters late (needs the cross to
 * confirm, so it misses the first part of a bull) and exits late (so it gives back
 * part of every top). In a long flat range it can lose slowly to fees.
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

  // Entry: golden cross on closed bars + price above 200d SMA.
  const goldenCross = ema50Prev != null && sma200Prev != null && ema50Prev <= sma200Prev && ema50 > sma200;
  if (goldenCross && prevClose > sma200) {
    if (ctx.alloc.status !== 'ok') return null; // reduce-only edge, no new entries
    // Reset the trailing-stop high for the new position (never inherit the old one).
    ctx.state = { hi: prevClose };
    const qty = (ctx.cash / price) * 0.99;
    if (qty <= 0) return null;
    ctx.watch([{ side: 'buy', note: 'golden cross above 200d' }]);
    return { side: 'buy', qty: qty };
  }
  return null;
}
