/*
 * @coinsori-strategy v1
 * name: Keltner MR Deep-Flush 3ATR
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The validated Keltner MR champion (EMA20 - 2.5x ATR, RSI<40)
 * makes low-risk money but lags melt-ups (few deep flushes to catch). This variant
 * widens the band to 3.0x ATR and tightens RSI to <35, so it only buys DEEPER,
 * rarer flushes — fewer trades but each potentially more profitable on the
 * snap-back. Tests whether a more selective entry improves the return/MDD tradeoff.
 * When it buys and sells: buys a deep flush to the lower Keltner band (EMA20 -
 * 3.0x ATR) with RSI<35 while price is above the 200-day average; sells on the
 * snap-back to the middle band (EMA20). ATR-scaled sizing keeps risk low.
 * When it does NOT work: in a shallow, grinding bull market there are few 3-ATR
 * flushes, so it sits in cash more than the champion — it may make even less
 * money in melt-ups, and the deeper band risks buying into a real crash.
 * 2026-04-10 표시만 바뀜, 매매 판단은 그대로
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

  const lower = ema20 - 3.0 * atr;
  const st = ctx.state;

  if (pos > 0) {
    ctx.watch([{ side: 'sell', price: ema20, trigger: 'above', qty: pos, note: 'EMA20 snap-back exit' }]);
    if (price > ema20) {
      st.cooldown = ctx.i + 2;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  if (st.cooldown != null && ctx.i < st.cooldown) {
    ctx.watch([{ side: 'buy', price: lower, trigger: 'below', note: 'deep flush entry', conds: [
      { label: 'cooldown over', ok: ctx.i >= st.cooldown },
      { label: 'Close > SMA200', now: price, op: '>', ref: sma200 },
      { label: 'RSI(14) close', now: rsi, op: '<', ref: 35, closed: true }
    ]}]);
    return null;
  }

  ctx.watch([{ side: 'buy', price: lower, trigger: 'below', note: 'deep flush entry', conds: [
    { label: 'Close > SMA200', now: price, op: '>', ref: sma200 },
    { label: 'RSI(14) close', now: rsi, op: '<', ref: 35, closed: true }
  ]}]);

  if (price > sma200 && price <= lower && rsi < 35) {
    st.cooldown = null;
    const riskEq = 0.015 * ctx.cash;
    const qty = riskEq / atr;
    const maxQty = ctx.cash / price * 0.9;
    return { side: 'buy', qty: Math.min(qty, maxQty) };
  }
  return null;
}
