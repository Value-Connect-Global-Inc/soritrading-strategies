/*
 * @coinsori-strategy v1
 * name: BTC RSI2 Panic Dip Capitulation 1D
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The RSI2 panic-dip rule is the validated champion on SOL (MDD 6-19%,
 * beat hold on every window). This ports that exact rule to BTC to test whether the edge
 * generalizes to a second, less volatile asset — BTC's panic dips are shallower but the
 * same capitulation psychology applies.
 * When it buys and sells: Buys when the 2-period RSI drops below 10, price is above the
 * 200-day average, AND price is at least 10% below its 50-day high. Sells after 5 days,
 * when RSI turns overbought, or on an 8% stop. After any exit it waits 10 days before
 * buying again.
 * When it does NOT work: BTC dips are often slower and shallower than SOL's, so RSI2<10
 * fires less often. In a grinding bear market price can keep falling after a capitulation.
 * No data before Aug 2020.
 */

function onUpdate(ctx) {
  const rsi = ctx.rsi(2, 1);
  const trend = ctx.sma(200, 1);
  const price = ctx.price;
  if (rsi == null || trend == null || price == null) return null;

  const st = ctx.state;

  if (ctx.position <= 0) {
    if (st.cooldownUntil != null && ctx.i < st.cooldownUntil) return null;
    const high50 = ctx.high(50, 1);
    if (high50 == null) return null;
    // Same capitulation-depth rule as the SOL champion: RSI2<10 + uptrend + >=10% off the
    // 50-day high. Guarantees we buy genuine panics, not shallow dips in a weak market.
    if (rsi < 10 && price > trend && price <= high50 * 0.90) {
      st.entryBar = ctx.i;
      ctx.watch([{ side: 'sell', price: price * 0.92, trigger: 'below', note: '8% stop' }]);
      return { side: 'buy', qty: (ctx.cash / price) * 0.9 };
    }
    return null;
  }

  const entry = ctx.entryPx || price;
  const barsHeld = ctx.i - (st.entryBar || ctx.i);
  const rsiNow = ctx.rsi(2, 0);
  const stopped = price <= entry * 0.92;
  ctx.watch([{ side: 'sell', price: entry * 0.92, trigger: 'below', note: '8% stop' }]);
  // Same exits as the champion: stop, overbought, or 5-day time limit.
  if (stopped || rsiNow > 70 || barsHeld >= 5) {
    st.cooldownUntil = ctx.i + 10;
    return { side: 'sell', qty: ctx.position };
  }
  return null;
}
