/*
 * @coinsori-strategy v1
 * name: SOL 1D Dual-MR Defensive (Bollinger+Keltner)
 * ex: binance
 * syms: SOLUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The BTC 1D Dual-MR defensive champion (2995) is the most robust validated
 * strategy in the book. This tests whether the SAME full recipe (Bollinger-RSI flush OR
 * ATR-adaptive Keltner pullback, rising-200d gate, ATR-risk sized) generalizes from BTC to SOL.
 * SOL 1d history only starts ~2020, so validation windows are shorter.
 * When it buys and sells: Buy when price closes below the lower Bollinger band (20,2.5) with
 * RSI<30, OR below the ATR-adaptive lower Keltner band with RSI<40, only inside a rising 200-day
 * average. Size by ATR risk (1% equity) capped at 90% cash. Sell on snap-back above the 20-day
 * EMA or RSI>55.
 * When it does NOT work: In a sustained bear the rising-trend gate keeps it flat, and it lags
 * buy-and-hold in a relentless melt-up. SOL has a short history and high beta, so the strict
 * RSI<30 trigger may fire rarely.
 *
 * 2025-02-15: display-only ctx.watch added — no change to trading logic.
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

  const uptrend = sma200 > sma200prev;
  const lowerBand = bb.lower;
  const keltnerLow = ema20 - 2.5 * atr;

  if (pos > 0) {
    const sellSignal = price > ema20 || rsi > 55;
    if (sellSignal) {
      ctx.watch([
        { side: 'sell', price: ema20, trigger: 'above', qty: pos, note: 'EMA20 snap-back', conds: [{ label: 'RSI(14) close', now: rsi, op: '>', ref: 55, closed: true }] },
        { side: 'sell', price: ema20, trigger: 'above', qty: pos, note: 'EMA20 snap-back' },
        { side: 'sell', price: ema20, trigger: 'above', qty: pos, note: 'EMA20 snap-back' }
      ]);
      return { side: 'sell', qty: pos };
    }
    ctx.watch([
      { side: 'sell', price: ema20, trigger: 'above', qty: pos, note: 'EMA20 snap-back', conds: [{ label: 'RSI(14) close', now: rsi, op: '>', ref: 55, closed: true }] },
      { side: 'sell', price: ema20, trigger: 'above', qty: pos, note: 'EMA20 snap-back' }
    ]);
    return null;
  }

  if (!uptrend) {
    ctx.watch([
      { side: 'buy', price: lowerBand, trigger: 'below', note: 'BB lower + RSI<30', conds: [{ label: 'RSI(14) close', now: rsi, op: '<', ref: 30, closed: true }, { label: 'SMA200 rising', ok: false }] },
      { side: 'buy', price: keltnerLow, trigger: 'below', note: 'Keltner low + RSI<40', conds: [{ label: 'RSI(14) close', now: rsi, op: '<', ref: 40, closed: true }, { label: 'SMA200 rising', ok: false }] }
    ]);
    return null;
  }

  const bollingerFlush = price < lowerBand && rsi < 30;
  const keltnerPullback = price < keltnerLow && rsi < 40;

  if (bollingerFlush || keltnerPullback) {
    const riskEq = 0.01 * ctx.cash;
    const qty = riskEq / atr;
    const maxQty = (ctx.cash / price) * 0.9;
    ctx.watch([
      { side: 'buy', price: lowerBand, trigger: 'below', note: 'BB lower + RSI<30', conds: [{ label: 'RSI(14) close', now: rsi, op: '<', ref: 30, closed: true }, { label: 'SMA200 rising', ok: uptrend }] },
      { side: 'buy', price: keltnerLow, trigger: 'below', note: 'Keltner low + RSI<40', conds: [{ label: 'RSI(14) close', now: rsi, op: '<', ref: 40, closed: true }, { label: 'SMA200 rising', ok: uptrend }] }
    ]);
    return { side: 'buy', qty: Math.min(qty, maxQty) };
  }
  ctx.watch([
    { side: 'buy', price: lowerBand, trigger: 'below', note: 'BB lower + RSI<30', conds: [{ label: 'RSI(14) close', now: rsi, op: '<', ref: 30, closed: true }, { label: 'SMA200 rising', ok: uptrend }] },
    { side: 'buy', price: keltnerLow, trigger: 'below', note: 'Keltner low + RSI<40', conds: [{ label: 'RSI(14) close', now: rsi, op: '<', ref: 40, closed: true }, { label: 'SMA200 rising', ok: uptrend }] }
  ]);
  return null;
}
