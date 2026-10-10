/*
 * @coinsori-strategy v1
 * name: BTC RSI2 Panic Dip HashrateFilter 1D
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The validated RSI2 panic-dip champion (3366) buys capitulation dips.
 * This version adds one on-chain filter: it only buys when the Bitcoin mining network is
 * still GROWING (hashrate above its 30-day average). A panic dip on a healthy, expanding
 * network is a buying opportunity; a dip while miners are leaving the network is a
 * structural decline, not a panic.
 * When it buys and sells: Buys when 2-period RSI is below 10, price is above the 200-day
 * average, price is at least 10% below its 50-day high, AND hashrate is above its 30-day
 * average. Sells after 5 days, when RSI turns overbought, or on an 8% stop. Waits 10 days
 * after any exit.
 * When it does NOT work: Hashrate is a slow series, so the filter can lag — it may keep
 * the strategy out of a real panic that comes right after a hashrate dip. In a grinding
 * bear where hashrate still grows, it does not help.
 */

function onUpdate(ctx) {
  const rsi = ctx.rsi(2, 1);
  const trend = ctx.sma(200, 1);
  const price = ctx.price;
  const hr = ctx.data('hashrate');
  const hrSma = ctx.data('hashrate_sma30');
  if (rsi == null || trend == null || price == null || hr == null || hrSma == null) return null;

  const st = ctx.state;

  if (ctx.position <= 0) {
    if (st.cooldownUntil != null && ctx.i < st.cooldownUntil) return null;
    const high50 = ctx.high(50, 1);
    if (high50 == null) return null;
    // Network-health filter: only buy while miners are still adding capacity.
    if (rsi < 10 && price > trend && price <= high50 * 0.90 && hr > hrSma) {
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
