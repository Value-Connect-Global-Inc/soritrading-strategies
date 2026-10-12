/*
 * @coinsori-strategy v1
 * name: ETH 1D Bollinger Mean-Reversion
 * ex: binance
 * syms: ETHUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: ETH overshoots down on fear and snaps back, and on the
 * daily timeframe the moves are larger and less noisy than on 4h, so each dip
 * is a cleaner mean-reversion opportunity. Buying a deep dip to the lower
 * Bollinger band when oversold, only while price is above its 200-day average,
 * then selling the bounce back to the middle band harvests that snap-back.
 * When it buys and sells: it buys when the daily close is below the 20-day lower
 * Bollinger band with RSI below 30 and price above the 200-day average. It sells
 * when price returns to the middle band or RSI climbs above 60. Size is
 * ATR-scaled (risk 2% on a 3-ATR stop).
 * When it does NOT work: in a strong melt-up it sits in cash and badly lags
 * buy-and-hold. In a sustained bear it rarely buys because price stays below the
 * 200-day average. Very few trades (a handful per year), so a single bad entry
 * matters a lot.
 *
 * 2025-01-14: display-only watch declaration added; trading logic unchanged.
 */
function onUpdate(ctx) {
  const bb = ctx.bb(20, 2, 1);
  const rsi = ctx.rsi(14, 1);
  const sma200 = ctx.sma(200, 1);
  const atr = ctx.atr(14, 1);
  const px = ctx.closes[ctx.closes.length - 2];
  if (bb == null || bb.lower == null || rsi == null || sma200 == null || atr == null || px == null) return null;

  if (ctx.position > 0) {
    ctx.watch([
      { side: 'sell', price: bb.mid, trigger: 'above', note: 'BB mid target', conds: [{ label: 'RSI(14) close', now: rsi, op: '>', ref: 60, closed: true }] },
      { side: 'sell', price: bb.mid, trigger: 'above', note: 'BB mid target' },
      { side: 'sell', price: 0, trigger: 'below', note: 'RSI exit', conds: [{ label: 'RSI(14) close', now: rsi, op: '>', ref: 60, closed: true }] }
    ]);
    if (px >= bb.mid || rsi > 60) return { side: 'sell', qty: ctx.position };
    return null;
  }

  ctx.watch([
    { side: 'buy', price: bb.lower, trigger: 'below', note: 'BB lower dip', conds: [
      { label: 'RSI(14) close', now: rsi, op: '<', ref: 30, closed: true },
      { label: 'Close > SMA200', ok: px > sma200 }
    ]}
  ]);

  if (px <= bb.lower && rsi < 30 && px > sma200) {
    const equity = ctx.cash + ctx.position * ctx.price;
    const stopDist = 3 * atr;
    const qty = Math.max(0, Math.min((equity * 0.02) / stopDist, (ctx.cash / ctx.price) * 0.95));
    if (qty > 0) return { side: 'buy', qty: qty };
  }
  return null;
}
