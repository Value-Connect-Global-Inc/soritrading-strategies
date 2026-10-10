/*
 * @coinsori-strategy v1
 * name: ETH RSI2 Panic Dip Capitulation 1D
 * ex: binance
 * syms: ETHUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The RSI2 panic-dip rule is validated on SOL (champion) and BTC (this
 * job's keeper). This ports the exact rule to ETH to test whether the edge generalizes to
 * a third major asset. ETH's swings sit between BTC and SOL, so the same capitulation
 * psychology should apply.
 * When it buys and sells: Buys when the 2-period RSI drops below 10, price is above the
 * 200-day average, AND price is at least 10% below its 50-day high. Sells after 5 days,
 * when RSI turns overbought, or on an 8% stop. After any exit it waits 10 days before
 * buying again.
 * When it does NOT work: If ETH's dips are too shallow to trigger RSI2<10 it will trade
 * rarely and lag buy-and-hold. In a grinding bear market price can keep falling after a
 * capitulation. No data before Aug 2020.
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
    // Identical rule to the SOL champion and BTC port: RSI2<10 + uptrend + >=10% off the
    // 50-day high. No ETH-specific tuning — this is a pure generalization test.
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
  if (stopped || rsiNow > 70 || barsHeld >= 5) {
    st.cooldownUntil = ctx.i + 10;
    return { side: 'sell', qty: ctx.position };
  }
  return null;
}
