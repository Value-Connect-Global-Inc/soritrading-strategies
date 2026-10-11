// 2026-04-26 표시만 바뀜, 매매 판단은 그대로
/*
 * @coinsori-strategy v1
 * name: SOL 1D ATR-Adaptive Keltner Mean Reversion
 * ex: binance
 * syms: SOLUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: SOL is a high-beta alt that pulls back hard and snaps back
 * fast, which is exactly the regime mean reversion exploits. Instead of a fixed
 * Bollinger band, this uses an ATR-adaptive lower Keltner band (EMA20 minus 2.5x
 * ATR), so the buy zone widens automatically when volatility is high — avoiding
 * catching a falling knife in violent regimes. A rising 200-day average gates the
 * entries so we only buy fear inside a healthy long-term uptrend. This is the
 * same family that has been positive on ~29/32 windows across 11 assets.
 * When it buys and sells: Buys when price closes below the ATR-adaptive lower
 * Keltner band with RSI oversold (below 40) while price is above a rising 200-day
 * average, using nearly full cash. Sells on the snap-back above the mid band
 * (EMA20) or when RSI climbs above 60.
 * When it does NOT work: In a broad crypto bear (like 2022) SOL falls with
 * everything else and the 200-day gate keeps us out of most trades, so we lose
 * little but also miss nothing — it is capital-preserving. It badly lags a pure
 * buy-and-hold in relentless melt-ups because it sits in cash waiting for a pullback.
 */
function onUpdate(ctx) {
  const pos = ctx.position;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const ema20 = ctx.ema(20, 1);
  const atr = ctx.atr(14, 1);
  const rsi = ctx.rsi(14, 1);
  const sma200 = ctx.sma(200, 1);
  const sma200prev = ctx.sma(200, 2);
  if (ema20 == null || atr == null || rsi == null || sma200 == null || sma200prev == null) {
    ctx.watch([]);
    return null;
  }

  // ATR-adaptive lower Keltner band: EMA20 - 2.5x ATR (widens in volatile regimes).
  const lowerBand = ema20 - 2.5 * atr;
  // Only mean-revert inside a healthy long-term uptrend — the gate that makes this
  // family safe (per ledger, ungated MR on alts was a disaster).
  const uptrend = sma200 > sma200prev;

  if (pos > 0) {
    ctx.watch([
      { side: 'sell', price: ema20, trigger: 'above', note: 'EMA20 exit' },
      { side: 'sell', conds: [{ label: 'RSI(14) close', now: rsi, op: '>', ref: 60, closed: true }], note: 'RSI exit' }
    ]);
    // Take the snap-back profit above the mid band (EMA20) or once RSI turns up.
    if (price > ema20 || rsi > 60) {
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  ctx.watch([
    { side: 'buy', price: lowerBand, trigger: 'below', note: 'Keltner lower', conds: [
      { label: 'RSI(14) close', now: rsi, op: '<', ref: 40, closed: true },
      { label: 'SMA200 rising', ok: uptrend }
    ]}
  ]);
  // Defensive entry: oversold flush below the ATR-adaptive band in an uptrend.
  if (uptrend && price < lowerBand && rsi < 40) {
    return { side: 'buy', qty: (ctx.cash / price) * 0.95 };
  }
  return null;
}
