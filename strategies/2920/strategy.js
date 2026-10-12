/*
 * @coinsori-strategy v1
 * name: ETH 4H Bollinger Mean-Reversion ATR-Sized
 * ex: binance
 * syms: ETHUSDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: ETH overshoots to the downside on fear and snaps back.
 * Buying a deep dip to the lower Bollinger band when the market is oversold
 * (low RSI), and only while price is above its 200-bar average (so it does not
 * catch a falling knife in a real crash), then selling the bounce back to the
 * middle band harvests that snap-back. This is the validated ETH mean-reversion
 * recipe from the ledger, using ATR-scaled position sizing.
 * When it buys and sells: it buys when price closes below the 20-bar lower
 * Bollinger band with RSI below 35 and price above the 200-bar average. It sells
 * when price returns to the middle band (20-bar average) or RSI climbs above 60.
 * Position size is scaled by volatility (ATR): higher volatility means a smaller
 * position so a single bad dip is cheap.
 * When it does NOT work: in a strong melt-up it sits in cash and badly lags
 * buy-and-hold (defensive by design). In a sustained bear it rarely buys because
 * price stays below the 200-bar average. In a choppy period like 2022-24 it can
 * lose money on dips that keep falling.
 * 2026-04-26: 표시만 바뀜, 매매 판단은 그대로 (ctx.watch added)
 */
function onUpdate(ctx) {
  const bb = ctx.bb(20, 2, 1);
  const rsi = ctx.rsi(14, 1);
  const sma200 = ctx.sma(200, 1);
  const atr = ctx.atr(14, 1);
  const px = ctx.closes[ctx.closes.length - 2];
  if (bb == null || bb.lower == null || rsi == null || sma200 == null || atr == null || px == null) {
    ctx.watch([]);
    return null;
  }

  // Exit: bounce back to the middle band, or RSI no longer oversold.
  if (ctx.position > 0) {
    ctx.watch([
      { side: 'sell', price: bb.mid, trigger: 'above', note: 'mid band exit' },
      { side: 'sell', conds: [{ label: 'RSI(14) close', now: rsi, op: '>', ref: 60, closed: true }], note: 'RSI exit' }
    ]);
    if (px >= bb.mid || rsi > 60) return { side: 'sell', qty: ctx.position };
    return null;
  }

  // Entry: deep dip to lower band + oversold, only above the 200-bar trend line.
  ctx.watch([
    { side: 'buy', price: bb.lower, trigger: 'below', note: 'BB lower touch', conds: [
      { label: 'RSI(14) close', now: rsi, op: '<', ref: 35, closed: true },
      { label: 'close > SMA200', now: px, op: '>', ref: sma200, closed: true }
    ]}
  ]);
  if (px <= bb.lower && rsi < 35 && px > sma200) {
    // ATR-scaled size: risk 2% of equity on a 2-ATR stop distance, so higher
    // volatility automatically shrinks the position (validated champion sizing).
    const equity = ctx.cash + ctx.position * ctx.price;
    const stopDist = 2 * atr;
    const qty = Math.max(0, Math.min((equity * 0.02) / stopDist, (ctx.cash / ctx.price) * 0.95));
    if (qty > 0) return { side: 'buy', qty: qty };
  }
  return null;
}
