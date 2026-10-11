/*
 * @coinsori-strategy v1
 * name: Upbit BTC 1D Volatility-Scaled Trend Rider
 * ex: upbit
 * syms: BTC
 * interval: 1d
 * cash: 10000000
 *
 * Why this strategy: Crypto trends persist, but the size of each move varies a lot.
 * Betting a fixed dollar amount on every trend lets one wild move wipe out the
 * account. This strategy sizes every position so each trade risks roughly the same
 * small percentage of capital, no matter how choppy the market is.
 * When it buys and sells: It buys when the medium-term trend is up (price above a
 * slow average) and momentum is positive. It sells (closes) when the trend flips
 * down or price falls more than a volatility-based stop. Position size shrinks
 * automatically when volatility is high.
 * When it does NOT work: In long sideways chop with no real trend it will whip back
 * and forth and bleed fees. It also lags sharp V-shaped reversals because it waits
 * for a slow average to flip.
 * 2026-04-12: 표시만 바뀜, 매매 판단은 그대로 (ctx.watch added)
 */
function onUpdate(ctx) {
  // Medium-term trend: price vs 50-day EMA.
  const ema50 = ctx.ema(50, 1);
  // Faster confirm: 20-day EMA.
  const ema20 = ctx.ema(20, 1);
  // Volatility: ATR(14) used for both the stop distance and position sizing.
  const atr = ctx.atr(14, 1);
  // Momentum guard: RSI(14) must not be extremely overbought at entry.
  const rsi = ctx.rsi(14, 1);
  if (ema50 == null || ema20 == null || atr == null || rsi == null) return null;

  const px = ctx.price;
  const pos = ctx.position || 0;

  // Risk per trade: 1.5% of equity. ATR stop distance ~2.5 * ATR.
  // Position size = riskAmount / (stopDistance). This is the volatility scaling.
  const riskAmt = ctx.cash * 0.015;
  const stopDist = atr * 2.5;
  if (stopDist <= 0) return null;
  const targetQty = riskAmt / stopDist;
  // Cap notional so we never use more than ~90% of cash.
  const maxQty = (ctx.cash / px) * 0.9;
  const qty = Math.min(targetQty, maxQty);
  if (qty <= 0) return null;

  const trendUp = px > ema50 && ema20 > ema50;

  if (pos === 0) {
    // Enter only when trend is up and not extremely overbought.
    ctx.watch([{
      side: 'buy',
      price: ema50,
      trigger: 'above',
      note: 'trend entry',
      conds: [
        { label: 'EMA20 > EMA50', ok: ema20 > ema50, closed: true },
        { label: 'RSI(14) < 72', now: rsi, op: '<', ref: 72, closed: true }
      ]
    }]);
    if (trendUp && rsi < 72) {
      return { side: 'buy', qty: qty };
    }
    return null;
  }

  // Exit: trend flipped down, or price fell more than the volatility stop,
  // or momentum got deeply overbought then rolled over.
  const stopPx = ctx.entryPx - stopDist;
  ctx.watch([
    { side: 'sell', price: stopPx, trigger: 'below', note: 'ATR stop' },
    { side: 'sell', price: ema50, trigger: 'below', note: 'trend flip' }
  ]);
  if (!trendUp || px < stopPx || rsi > 82) {
    return { side: 'sell', qty: pos };
  }
  return null;
}
