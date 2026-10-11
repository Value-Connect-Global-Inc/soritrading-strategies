/*
 * @coinsori-strategy v1
 * name: SOL 1D ATR-Adaptive Keltner MR (Vol-Scaled)
 * ex: binance
 * syms: SOLUSDT
 * interval: 1d
 * cash: 10000
 *
 * 2026-04-26: 표시만 바뀜, 매매 판단은 그대로
 *
 * Why this strategy: same ATR-adaptive Keltner mean-reversion recipe as the
 * validated SOL 1D champion, but with volatility-scaled position sizing. The
 * champion's one weak point is high drawdown on high-beta SOL (39% on the
 * 2020-22 window) from full-cash sizing. Scaling the position down when ATR is
 * wide (violent regime) and up when ATR is narrow keeps each trade's daily
 * volatility exposure roughly constant, which should cut drawdown without
 * giving up the defensive edge.
 * When it buys and sells: buys when price closes below the ATR-adaptive lower
 * Keltner band (EMA20 - 2.5x ATR) with RSI oversold while price is above a
 * rising 200-day average, sized so the trade risks a target fraction of equity
 * per ATR. Sells on the snap-back above the mid band (EMA20) or RSI above 60.
 * When it does NOT work: in a broad crypto bear the 200-day gate keeps us out
 * of most trades (capital-preserving), and it lags buy-and-hold in relentless
 * melt-ups because it sits in cash waiting for a pullback.
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
    if (price > ema20 || rsi > 60) {
      ctx.watch([]);
      return { side: 'sell', qty: pos };
    }
    ctx.watch([
      { side: 'sell', price: ema20, trigger: 'above', note: 'EMA20 snap-back' },
      { side: 'sell', conds: [{ label: 'RSI(14)', now: rsi, op: '>', ref: 60, closed: true }], note: 'RSI overbought exit' }
    ]);
    return null;
  }

  // Defensive entry: oversold flush below the ATR-adaptive band in an uptrend.
  if (uptrend && price < lowerBand && rsi < 40) {
    // Volatility-scaled sizing: target ~9% of equity as daily ATR exposure.
    // qty = equity*targetVol/atr — full position at ~9% ATR, smaller only in
    // extreme-vol spikes (SOL's typical ATR is ~5-9%, so positions stay near full).
    const targetVol = 0.09;
    let qty = (ctx.cash * targetVol) / atr;
    // Never risk more than 95% of cash on one entry.
    qty = Math.min(qty, (ctx.cash / price) * 0.95);
    if (qty <= 0) {
      ctx.watch([]);
      return null;
    }
    ctx.watch([]);
    return { side: 'buy', qty: qty };
  }
  ctx.watch([
    { side: 'buy', price: lowerBand, trigger: 'below', note: 'ATR-adaptive Keltner lower touch', conds: [
      { label: 'Uptrend SMA200 rising', ok: uptrend },
      { label: 'RSI(14)', now: rsi, op: '<', ref: 40, closed: true }
    ]}
  ]);
  return null;
}
