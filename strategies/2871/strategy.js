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
 * 2025-04-26 표시만 바뀜, 매매 판단은 그대로
 */
function onUpdate(ctx) {
  const pos = ctx.position;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) {
    ctx.watch([]);
    return null;
  }

  const ema20 = ctx.ema(20, 1);
  const atr = ctx.atr(14, 1);
  const sma200 = ctx.sma(200, 1);
  const rsi = ctx.rsi(14, 1);
  if (ema20 == null || atr == null || sma200 == null || rsi == null || atr <= 0) {
    ctx.watch([]);
    return null;
  }

  const lower = ema20 - 2.5 * atr;
  const st = ctx.state;
  const cooldownActive = st.cooldown != null && ctx.i < st.cooldown;

  if (pos > 0) {
    ctx.watch([{
      side: 'sell',
      price: ema20,
      trigger: 'above',
      qty: pos,
      note: 'EMA20 snap-back'
    }]);
    if (price > ema20) {
      st.cooldown = ctx.i + 2;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  if (cooldownActive) {
    ctx.watch([{
      side: 'buy',
      price: lower,
      trigger: 'below',
      note: 'Keltner lower band',
      conds: [
        { label: 'price > SMA200', now: price, op: '>', ref: sma200 },
        { label: 'RSI(14) < 40', now: rsi, op: '<', ref: 40, closed: true },
        { label: 'cooldown done', ok: false }
      ]
    }]);
    return null;
  }

  ctx.watch([{
    side: 'buy',
    price: lower,
    trigger: 'below',
    note: 'Keltner lower band',
    conds: [
      { label: 'price > SMA200', now: price, op: '>', ref: sma200 },
      { label: 'RSI(14) < 40', now: rsi, op: '<', ref: 40, closed: true }
    ]
  }]);

  if (price > sma200 && price <= lower && rsi < 40) {
    st.cooldown = null;
    // ATR-scaled size: risk 1.5% of equity per trade, in coin units.
    const riskEq = 0.015 * ctx.cash;
    const qty = riskEq / atr;
    const maxQty = ctx.cash / price * 0.9;
    return { side: 'buy', qty: Math.min(qty, maxQty) };
  }
  return null;
}
