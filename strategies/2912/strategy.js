/*
 * @coinsori-strategy v1
 * name: SOL 4H ATR-Adaptive Mean-Reversion
 * ex: binance
 * syms: SOLUSDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: High-volatility coins like SOL overshoot on fear and snap
 * back. Instead of a fixed Bollinger band, this uses a volatility-adaptive lower
 * band (20-bar average minus 2.5 ATR) that widens exactly when volatility does,
 * so it only buys genuinely deep dips. Selling the bounce back to the average
 * harvests the snap-back. This is the same recipe the ledger validated positive
 * on ETH, BTC and SOL.
 * When it buys and sells: it buys when price closes below the lower band with
 * RSI below 40, and sells when price returns to the 20-bar average or RSI climbs
 * above 60. A 2-bar cooldown after each exit avoids re-buying the same dip.
 * When it does NOT work: in a strong melt-up it sits in cash and badly lags
 * buy-and-hold (defensive by design). In a sustained bear it keeps buying dips
 * that keep going down, so it can lose money while a pure cash position would
 * have done better.
 *
 * 2026-01-18: watch 선언만 추가 — 표시만 바뀜, 매매 판단은 그대로.
 */
function onUpdate(ctx) {
  const ema20 = ctx.ema(20, 1);
  const atr = ctx.atr(14, 1);
  const rsi = ctx.rsi(14, 1);
  const px = ctx.closes[ctx.closes.length - 2];
  if (ema20 == null || atr == null || rsi == null || px == null) return null;

  const lower = ema20 - 2.5 * atr; // volatility-adaptive lower band

  // Exit: bounce back to the 20-bar average, or RSI no longer oversold.
  if (ctx.position > 0) {
    if (px >= ema20 || rsi > 60) {
      ctx.state.lastExit = ctx.i;
      return { side: 'sell', qty: ctx.position };
    }
    ctx.watch([
      { side: 'sell', price: ema20, trigger: 'above', note: 'bounce to EMA20', conds: [
        { label: 'RSI(14) close', now: rsi, op: '>', ref: 60, closed: true }
      ]},
      { side: 'sell', price: null, trigger: 'above', note: 'RSI>60', conds: [
        { label: 'RSI(14) close', now: rsi, op: '>', ref: 60, closed: true }
      ]}
    ]);
    return null;
  }

  // Cooldown: wait 2 bars after the last exit before re-entering.
  const since = ctx.i - (ctx.state.lastExit || -999);
  if (since < 2) return null;

  // Entry: deep dip below the adaptive band + oversold.
  if (px <= lower && rsi < 40) {
    // Risk 0.5% of equity on a 2-ATR stop -> volatility-scaled size.
    const equity = ctx.cash + ctx.position * ctx.price;
    const qty = Math.max(0, Math.min((equity * 0.005) / (2 * atr), (ctx.cash / ctx.price) * 0.99));
    if (qty > 0) return { side: 'buy', qty: qty };
  }
  ctx.watch([
    { side: 'buy', price: lower, trigger: 'below', note: 'deep dip below adaptive band', conds: [
      { label: 'RSI(14) close', now: rsi, op: '<', ref: 40, closed: true }
    ]}
  ]);
  return null;
}
