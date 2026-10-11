/*
 * @coinsori-strategy v1
 * name: BTC Active-Address Demand Trend 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: On-chain active addresses measure real user demand for
 * Bitcoin. When demand accelerates (addresses well above their 30-day average)
 * while the long-term trend is up, price tends to keep rising; when demand
 * clearly cools or the trend breaks, we exit. This is a different data family
 * from price-only pullback strategies — it bets on adoption/usage, not on
 * bounces. A wide hysteresis band turns the noisy daily metric into a slow
 * regime signal so we are not whipsawed by one-day wobbles.
 * When it buys and sells: buy when active addresses are >= 10% above their
 * 30-day average AND price is above the 200-day EMA (and RSI not above 70).
 * Sell when addresses fall to <= 5% BELOW their 30-day average, or price
 * closes below the 200-day EMA, or a 2.5x ATR stop from entry is hit.
 * When it does NOT work: it lags a melt-up (addresses plateau while price
 * runs), and it can whipsaw in a sideways chop where addresses hover around
 * their average. Slow-moving data means few trades — expect long flat periods.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const addr = ctx.data('addr');
  const addrSma = ctx.data('addr_sma30');
  const ema200 = ctx.ema(200, 1);
  const atr = ctx.atr(14, 1);
  if (addr == null || addrSma == null || ema200 == null || atr == null) return null;

  const pos = ctx.position;
  if (pos > 0) {
    const stopPx = ctx.entryPx - 2.5 * atr;
    if (price <= stopPx) return { side: 'sell', qty: pos };
    // demand must clearly cool (5% below its 30d avg) before we exit
    if (addr <= addrSma * 0.95) return { side: 'sell', qty: pos };
    if (price < ema200) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: 'hard stop' },
               { side: 'sell', price: ema200, trigger: 'below', note: 'trend break' },
               { side: 'sell', note: 'addresses cooling', conds: [{ label: 'addr vs sma30', now: addr, op: '<=', ref: addrSma * 0.95, closed: true }] }]);
    return null;
  }

  // demand must strongly accelerate: addresses >=10% above their 30d average
  if (addr < addrSma * 1.10) return null;
  // long-term uptrend intact — never buy into a broken market
  if (price <= ema200) return null;
  // skip euphoric blow-off tops (RSI>70) — chasing has no edge here
  const rsi = ctx.rsi(14, 1);
  if (rsi != null && rsi > 70) return null;

  const riskCash = ctx.cash * 0.01;        // 1% equity risked per trade
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.30) / price; // cap position at 30% of cash
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
