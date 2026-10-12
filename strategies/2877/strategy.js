/*
 * @coinsori-strategy v1
 * name: Keltner MR Daily (validated champion)
 * ex: binance
 * syms: BTCUSDT, ETHUSDT, SOLUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The ATR-adaptive Keltner mean-reversion recipe was validated
 * positive across ~29/32 windows on 11 assets at 4h, and ~13/14 windows across
 * 9 assets at 1d. This is the full validated champion. It buys deep flushes to
 * the lower Keltner band and sells on the snap-back to the middle band.
 * When it buys and sells: buys a flush to the lower Keltner band (EMA20 - 2.5x
 * ATR) with RSI<40 while price is above the 200-day average; sells on the
 * snap-back to the middle band (EMA20). A 2-bar cooldown prevents re-buying.
 * Position is ATR-scaled so volatile assets get smaller size.
 * When it does NOT work: in a persistent downtrend below the 200-day average it
 * stays idle, and it lags straight-line melt-ups (few deep flushes to catch).
 *
 * 2025-01-15: only added ctx.watch declarations — display only, trading logic unchanged.
 */
function onUpdate(ctx) {
  const pos = ctx.position;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const ema20 = ctx.ema(20, 1);
  const atr = ctx.atr(14, 1);
  const sma200 = ctx.sma(200, 1);
  const rsi = ctx.rsi(14, 1);
  if (ema20 == null || atr == null || sma200 == null || rsi == null || atr <= 0) return null;

  const lower = ema20 - 2.5 * atr;
  const st = ctx.state;

  if (pos > 0) {
    ctx.watch([
      { side: 'sell', price: ema20, trigger: 'above', qty: pos, note: 'Sell at EMA20 mean-reversion target' },
    ]);
    if (price > ema20) {
      st.cooldown = ctx.i + 2;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  if (st.cooldown != null && ctx.i < st.cooldown) {
    ctx.watch([
      { side: 'buy', price: lower, trigger: 'below', qty: (0.015 * ctx.cash) / atr, note: 'Cooldown until bar ' + st.cooldown, conds: [
        { label: 'RSI(14) close', now: rsi, op: '<', ref: 40, closed: true },
        { label: 'Price > SMA200 close', now: price, op: '>', ref: sma200, closed: true },
      ]},
      { side: 'sell', price: ema20, trigger: 'above', note: 'Exit at EMA20' },
    ]);
    return null;
  }

  if (price > sma200 && price <= lower && rsi < 40) {
    const riskEq = 0.015 * ctx.cash;
    const qty = riskEq / atr;
    const maxQty = ctx.cash / price * 0.9;
    const buyQty = Math.min(qty, maxQty);
    ctx.watch([
      { side: 'buy', price: lower, trigger: 'below', qty: buyQty, note: 'Buy at lower Keltner band', conds: [
        { label: 'RSI(14) close', now: rsi, op: '<', ref: 40, closed: true },
        { label: 'Price > SMA200 close', now: price, op: '>', ref: sma200, closed: true },
      ]},
      { side: 'sell', price: ema20, trigger: 'above', note: 'Exit at EMA20' },
    ]);
    st.cooldown = null;
    return { side: 'buy', qty: buyQty };
  }

  ctx.watch([
    { side: 'buy', price: lower, trigger: 'below', qty: (0.015 * ctx.cash) / atr, note: 'Buy at lower Keltner band', conds: [
      { label: 'RSI(14) close', now: rsi, op: '<', ref: 40, closed: true },
      { label: 'Price > SMA200 close', now: price, op: '>', ref: sma200, closed: true },
    ]},
    { side: 'sell', price: ema20, trigger: 'above', note: 'Exit at EMA20' },
  ]);
  return null;
}
