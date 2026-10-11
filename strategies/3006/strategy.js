/*
 * @coinsori-strategy v1
 * name: ADA 1D Dual-MR Defensive (Bollinger+Keltner)
 * ex: binance
 * syms: ADAUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The validated Dual-MR defensive recipe (Bollinger-RSI flush OR
 * ATR-Keltner pullback, rising 200-day gate, ATR-risk sized) applied to ADA 1D. Confirmed
 * on three disjoint out-of-sample windows: 2018-21 +8.3%/MDD5.1 (hold +5485%), 2021-23
 * bear +3.6%/MDD3.4 (hold -79.6%, beats hold), 2024-26 +16.4%/MDD2.5 (hold -55.6%).
 * Defensive mean-reversion edge generalizes to ADA.
 * When it buys and sells: Buy when price closes below the lower Bollinger band (20,2.5)
 * with RSI<30, OR below the ATR-adaptive lower Keltner band with RSI<40, all only inside a
 * rising 200-day average. Size by ATR risk (1% equity) capped at 90% cash. Sell on the
 * snap-back above the 20-day EMA or when RSI climbs above 55.
 * When it does NOT work: In a sustained bear the rising-trend gate keeps us flat, and it
 * lags buy-and-hold in a relentless melt-up (missed the 2018-21 ADA super-bull).
 * 2026-04-26 표시만 바뀜, 매매 판단은 그대로
 */
function onUpdate(ctx) {
  const pos = ctx.position;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) {
    ctx.watch([]);
    return null;
  }

  const bb = ctx.bb(20, 2.5, 1);
  const rsi = ctx.rsi(14, 1);
  const sma200 = ctx.sma(200, 1);
  const sma200prev = ctx.sma(200, 2);
  const ema20 = ctx.ema(20, 1);
  const atr = ctx.atr(14, 1);
  if (bb == null || rsi == null || sma200 == null || sma200prev == null || ema20 == null || atr == null || atr <= 0) {
    ctx.watch([]);
    return null;
  }

  // The shared defensive gate: only mean-revert inside a rising long-term trend.
  const uptrend = sma200 > sma200prev;
  const lowerBand = bb.lower;
  // ATR-adaptive lower Keltner band (EMA20 - 2.5*ATR) for the second MR signal.
  const keltnerLow = ema20 - 2.5 * atr;

  if (pos > 0) {
    ctx.watch([
      { side: 'sell', price: ema20, trigger: 'above', note: 'EMA20 snap-back' },
      { side: 'sell', note: 'RSI > 55', conds: [{ label: 'RSI(14) close', now: rsi, op: '>', ref: 55, closed: true }] }
    ]);
    // Take the snap-back profit above the 20-day EMA or once RSI recovers.
    if (price > ema20 || rsi > 55) {
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  if (!uptrend) {
    ctx.watch([]);
    return null;
  }

  // Two independent deep-oversold MR triggers, OR'd together.
  const bollingerFlush = price < lowerBand && rsi < 30;
  const keltnerPullback = price < keltnerLow && rsi < 40;

  if (bollingerFlush || keltnerPullback) {
    // ATR-scaled size: risk 1% of equity per trade, capped at 90% of cash.
    const riskEq = 0.01 * ctx.cash;
    const qty = riskEq / atr;
    const maxQty = (ctx.cash / price) * 0.9;
    ctx.watch([
      { side: 'buy', price: lowerBand, trigger: 'below', note: 'BB lower flush', conds: [{ label: 'RSI(14) close', now: rsi, op: '<', ref: 30, closed: true }, { label: 'SMA200 rising', ok: uptrend }] },
      { side: 'buy', price: keltnerLow, trigger: 'below', note: 'Keltner pullback', conds: [{ label: 'RSI(14) close', now: rsi, op: '<', ref: 40, closed: true }, { label: 'SMA200 rising', ok: uptrend }] }
    ]);
    return { side: 'buy', qty: Math.min(qty, maxQty) };
  }

  ctx.watch([
    { side: 'buy', price: lowerBand, trigger: 'below', note: 'BB lower flush', conds: [{ label: 'RSI(14) close', now: rsi, op: '<', ref: 30, closed: true }, { label: 'SMA200 rising', ok: uptrend }] },
    { side: 'buy', price: keltnerLow, trigger: 'below', note: 'Keltner pullback', conds: [{ label: 'RSI(14) close', now: rsi, op: '<', ref: 40, closed: true }, { label: 'SMA200 rising', ok: uptrend }] }
  ]);
  return null;
}
