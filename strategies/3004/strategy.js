/*
 * @coinsori-strategy v1
 * name: BNB 1D Dual-MR Defensive (Bollinger+Keltner)
 * ex: binance
 * syms: BNBUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The BTC 1D Dual-MR defensive champion (2995) is the most robust validated
 * strategy in the book, and the same full recipe already generalized to ETH (3002) and SOL (3003).
 * This tests whether it also holds on BNB — a large-cap alt with ~9 years of 1D history not yet
 * tested. A positive result would give a diversified defensive portfolio across BTC/ETH/SOL/BNB.
 * When it buys and sells: Buy when price closes below the lower Bollinger band (20,2.5) with
 * RSI<30, OR below the ATR-adaptive lower Keltner band (EMA20-2.5*ATR) with RSI<40, only inside a
 * rising 200-day average. Size by ATR risk (1% equity) capped at 90% cash. Sell on snap-back above
 * the 20-day EMA or when RSI>55.
 * When it does NOT work: In a sustained bear the rising-trend gate keeps it flat (capital-safe but
 * little upside), and it lags buy-and-hold in a relentless melt-up. Low trade count means the edge
 * depends on the few flushes that mark a local bottom. BNB has a high-beta history so the strict
 * RSI<30 trigger may fire rarely.
 */
/*
 * 2025-01-27: Display-only change — added ctx.watch declarations. Trading logic unchanged.
 */
function onUpdate(ctx) {
  const pos = ctx.position;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const bb = ctx.bb(20, 2.5, 1);
  const rsi = ctx.rsi(14, 1);
  const sma200 = ctx.sma(200, 1);
  const sma200prev = ctx.sma(200, 2);
  const ema20 = ctx.ema(20, 1);
  const atr = ctx.atr(14, 1);
  if (bb == null || rsi == null || sma200 == null || sma200prev == null || ema20 == null || atr == null || atr <= 0) return null;

  // Shared defensive gate: only mean-revert inside a rising long-term trend.
  const uptrend = sma200 > sma200prev;
  const lowerBand = bb.lower;
  // ATR-adaptive lower Keltner band for the second MR signal.
  const keltnerLow = ema20 - 2.5 * atr;

  if (pos > 0) {
    // Take the snap-back profit above the 20-day EMA or once RSI recovers.
    if (price > ema20 || rsi > 55) {
      ctx.watch([{ side: 'sell', price: ema20, trigger: 'above', qty: pos, note: 'EMA20 snap-back' }]);
      return { side: 'sell', qty: pos };
    }
    ctx.watch([
      { side: 'sell', price: ema20, trigger: 'above', qty: pos, note: 'EMA20 snap-back' },
      { side: 'sell', price: 55, trigger: 'above', qty: pos, note: 'RSI recovery', conds: [{ label: 'RSI(14) close', now: rsi, op: '>', ref: 55, closed: true }] }
    ]);
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
    ctx.watch([]);
    return { side: 'buy', qty: Math.min(qty, maxQty) };
  }

  const bollingerCond = [{ label: 'Price < BB lower', now: price, op: '<', ref: lowerBand, closed: true }, { label: 'RSI(14) < 30', now: rsi, op: '<', ref: 30, closed: true }];
  const keltnerCond = [{ label: 'Price < Keltner low', now: price, op: '<', ref: keltnerLow, closed: true }, { label: 'RSI(14) < 40', now: rsi, op: '<', ref: 40, closed: true }];
  ctx.watch([
    { side: 'buy', price: lowerBand, trigger: 'below', note: 'BB lower flush', conds: bollingerCond },
    { side: 'buy', price: keltnerLow, trigger: 'below', note: 'Keltner pullback', conds: keltnerCond }
  ]);
  return null;
}
