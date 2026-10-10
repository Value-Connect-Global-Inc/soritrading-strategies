/*
 * @coinsori-strategy v1
 * name: BTC RSI2 Panic Dip RisingTrend 1D
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The RSI2 panic-dip rule validated on SOL and BTC. This variant adds
 * one filter: the 200-day average must be RISING, so we only buy panic dips inside a
 * confirmed uptrend. BTC bear markets are long and shallow — a falling 200-day line means
 * the panic is more likely a continuing decline than a buyable capitulation.
 * When it buys and sells: Buys when RSI2 drops below 10, price is above the 200-day
 * average, that average is higher than 20 days ago, AND price is at least 10% below its
 * 50-day high. Sells after 5 days, when RSI turns overbought, or on an 8% stop. Waits 10
 * days after any exit.
 * When it does NOT work: The rising-trend filter makes it fire even less often, so in a
 * strong bull it sits out more of the move and lags buy-and-hold further. It may also miss
 * the first dip of a new bull (the 200-day line is still falling right after the bottom).
 */

function onUpdate(ctx) {
  const rsi = ctx.rsi(2, 1);
  const trend = ctx.sma(200, 1);
  const trendPrev = ctx.sma(200, 21);
  const price = ctx.price;
  if (rsi == null || trend == null || trendPrev == null || price == null) return null;

  const st = ctx.state;

  if (ctx.position <= 0) {
    if (st.cooldownUntil != null && ctx.i < st.cooldownUntil) return null;
    const high50 = ctx.high(50, 1);
    if (high50 == null) return null;
    // Rising 200-day filter: only buy capitulation inside a confirmed uptrend. This is the
    // anti-bear rule — it should cut the shallow-bear losses the plain port took in 2022.
    if (rsi < 10 && price > trend && trend > trendPrev && price <= high50 * 0.90) {
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
