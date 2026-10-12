/*
 * @coinsori-strategy v1
 * name: SOL 1D Vol-Scaled Mean Reversion
 * ex: binance
 * syms: SOLUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: SOL's daily chart repeatedly overshoots to the downside
 * during panic (wide Bollinger band, deeply oversold RSI) and then snaps back
 * toward its average. Buying these panic dips and letting the snap-back happen
 * is a classic mean-reversion trade, common in volatile altcoins.
 * When it buys and sells: it buys when price touches the lower Bollinger band
 * AND RSI is below 30 (deep oversold), sizing the position smaller when
 * volatility (ATR) is high. It sells when price climbs back above the middle
 * band (mean reversion complete) or RSI recovers above 55.
 * When it does NOT work: in a sustained bear market the price keeps falling
 * through the lower band and "catching the knife" loses money — this strategy
 * needs mean-reversion to win, not a one-way downtrend.
 * 2026-05-13: 표시만 바뀜, 매매 판단은 그대로 (ctx.watch 선언만 추가)
 */
function onUpdate(ctx) {
  ctx.watch([]); // default: no wait condition (warm-up / no concrete level)
  const bb = ctx.bb(20, 2, 1);
  const rsi = ctx.rsi(14, 1);
  const atr = ctx.atr(14, 1);
  const mid = bb ? bb.mid : null;
  if (bb == null || rsi == null || atr == null || mid == null) return null;
  if (bb.lower == null || bb.upper == null) return null;

  const px = ctx.closes[ctx.closes.length - 2]; // last closed bar
  if (px == null) return null;

  const pos = ctx.position || 0;

  // Display-only: declare what this symbol is waiting for right now.
  if (pos > 0) {
    ctx.watch([
      { side: 'sell', price: mid, trigger: 'above', note: 'exit: mid band or RSI>55' }
    ]);
  } else {
    ctx.watch([
      { side: 'buy', price: bb.lower, trigger: 'below', note: 'entry: lower band touch',
        conds: [{ label: 'RSI(14) close', now: rsi, op: '<', ref: 30, closed: true }] }
    ]);
  }

  // EXIT: mean reversion complete when price is back above the middle band,
  // or RSI has recovered strongly. Either means the panic is over.
  if (pos > 0) {
    if (px >= mid || rsi > 55) return { side: 'sell', qty: pos };
    return null;
  }

  // ENTRY: deep oversold at the lower band = panic bottom candidate.
  // Require price actually at/below the lower band, not just near it.
  if (px <= bb.lower && rsi < 30) {
    // Size by volatility: smaller position when ATR is large (risk control).
    // Base 100% of cash, scaled down as ATR grows beyond 4% of price.
    const atrPct = atr / px;
    const scale = Math.max(0.25, Math.min(1.0, 0.04 / atrPct));
    const qty = (ctx.cash / ctx.price) * 0.95 * scale;
    if (qty > 0) return { side: 'buy', qty: qty };
  }
  return null;
}
