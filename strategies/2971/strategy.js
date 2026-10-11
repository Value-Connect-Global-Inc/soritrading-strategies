/*
 * @coinsori-strategy v1
 * name: XRP 1D ATR-Adaptive Keltner Mean Reversion
 * ex: binance
 * syms: XRPUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The ATR-adaptive Keltner mean-reversion recipe is the single
 * most robust edge in this ledger — positive on ~29/32 walk-forward windows across
 * 11 assets (BTC/ETH/SOL/LINK/ADA/BNB/DOGE). XRP is a large-cap alt that flushes
 * hard then snaps back, exactly the regime this family exploits. An ATR-adaptive
 * lower band (EMA20 - 2.5x ATR) widens the buy zone automatically in volatile
 * regimes so we avoid catching falling knives.
 * When it buys and sells: Buys when price closes below the ATR-adaptive lower Keltner
 * band with RSI oversold (below 40) while price is above a rising 200-day average,
 * using nearly full cash. Sells on the snap-back above the mid band (EMA20) or when
 * RSI climbs above 60.
 * When it does NOT work: In a broad crypto bear XRP falls with everything and the
 * 200-day gate keeps us out of most trades (capital-preserving but captures little).
 * It badly lags buy-and-hold in a relentless melt-up because it sits in cash waiting
 * for a pullback. MDD is low but a gap can still hurt.
 *
 * 2025-04-16: Added ctx.watch declarations only — display changes, trading logic unchanged.
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
  if (ema20 == null || atr == null || rsi == null || sma200 == null || sma200prev == null) return null;

  // ATR-adaptive lower Keltner band: EMA20 - 2.5x ATR (widens in volatile regimes).
  const lowerBand = ema20 - 2.5 * atr;
  // Only mean-revert inside a healthy long-term uptrend — the gate that makes this
  // family safe (per ledger, ungated MR on alts was a disaster).
  const uptrend = sma200 > sma200prev;

  if (pos > 0) {
    // Take the snap-back profit above the mid band (EMA20) or once RSI turns up.
    // Declare exit waits: above EMA20 (mid band) or RSI > 60.
    ctx.watch([
      { side: 'sell', price: ema20, trigger: 'above', note: 'mid band exit', conds: [
        { label: 'RSI(14)', now: rsi, op: '>', ref: 60, closed: true }
      ]},
      { side: 'sell', price: null, trigger: 'above', note: 'RSI exit', conds: [
        { label: 'RSI(14)', now: rsi, op: '>', ref: 60, closed: true },
        { label: 'Price > EMA20', ok: price > ema20 }
      ]}
    ]);
    if (price > ema20 || rsi > 60) {
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  // Defensive entry: oversold flush below the ATR-adaptive band in an uptrend.
  // Declare entry wait: price below lower band AND RSI < 40 AND uptrend.
  ctx.watch([
    { side: 'buy', price: lowerBand, trigger: 'below', note: 'lower Keltner band', conds: [
      { label: 'RSI(14)', now: rsi, op: '<', ref: 40, closed: true },
      { label: 'SMA200 rising', ok: uptrend }
    ]}
  ]);
  if (uptrend && price < lowerBand && rsi < 40) {
    return { side: 'buy', qty: (ctx.cash / price) * 0.95 };
  }
  return null;
}
