/*
 * @coinsori-strategy v1
 * name: Multi-Asset RSI2 Panic Basket 1D
 * ex: binance
 * syms: BTCUSDT, ETHUSDT, SOLUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The single-asset RSI2 panic-dip rule is the validated champion on SOL
 * and BTC. This version runs the SAME rule on three liquid assets at once, sharing one cash
 * pool, so the basket catches whichever asset panics next instead of waiting for one.
 * When it buys and sells: On each asset, buys when its 2-period RSI is below 10, its price
 * is above its 200-day average, and it is at least 10% below its 50-day high. Sells that
 * asset after 5 days, when its RSI turns overbought, or on an 8% stop, then waits 10 days
 * before buying it again. Each asset gets up to a third of the cash.
 * When it does NOT work: In a broad coordinated crypto bear all three assets fall together
 * and the rising-trend gate keeps capital flat. A single-asset melt-up still lags holding
 * that asset. On ETH the rule alone was weak, so the basket's edge depends on SOL+BTC.
 */

function onUpdate(ctx) {
  const sym = ctx.sym;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const rsi = ctx.rsi(2, 1);
  const trend = ctx.sma(200, 1);
  if (rsi == null || trend == null) return null;

  // Per-symbol state — ctx.state is ONE object shared by all symbols in the basket.
  if (!ctx.state.s) ctx.state.s = {};
  const s = ctx.state.s[sym] || (ctx.state.s[sym] = {});

  const pos = ctx.pos(sym);
  if (pos > 0) {
    const entry = ctx.entryPx || price;
    const barsHeld = ctx.i - (s.entryBar || ctx.i);
    const rsiNow = ctx.rsi(2, 0);
    const stopped = price <= entry * 0.92;
    ctx.watch([{ side: 'sell', price: entry * 0.92, trigger: 'below', note: '8% stop' }]);
    if (stopped || rsiNow > 70 || barsHeld >= 5) {
      s.cooldownUntil = ctx.i + 10;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  if (s.cooldownUntil != null && ctx.i < s.cooldownUntil) return null;
  const high50 = ctx.high(50, 1);
  if (high50 == null) return null;
  // Same capitulation rule as the champion, applied per asset.
  if (rsi < 10 && price > trend && price <= high50 * 0.90) {
    s.entryBar = ctx.i;
    // One third of the pool per asset so up to three panics can be held at once.
    const share = ctx.cash / 3;
    ctx.watch([{ side: 'sell', price: price * 0.92, trigger: 'below', note: '8% stop' }]);
    return { side: 'buy', qty: (share / price) * 0.9 };
  }
  return null;
}
