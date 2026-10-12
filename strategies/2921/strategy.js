/*
 * @coinsori-strategy v1
 * name: ETH 4H Bollinger MR Strong-Trend-Gated
 * ex: binance
 * syms: ETHUSDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: ETH overshoots to the downside on fear and snaps back, but
 * only in an uptrend. The plain mean-reversion loses money in bear/choppy
 * regimes (2022-24) because it buys dips that keep falling. This version adds a
 * strong trend gate: it only buys when the 50-bar average is ABOVE the 200-bar
 * average (a confirmed uptrend) AND price is above the 200-bar average. That
 * keeps it out of sustained downtrends where mean-reversion bleeds.
 * When it buys and sells: it buys when price closes below the 20-bar lower
 * Bollinger band with RSI below 35, price above the 200-bar average, AND the
 * 50-bar average above the 200-bar average. It sells when price returns to the
 * middle band or RSI climbs above 60. Size is ATR-scaled (risk 2% on 2-ATR).
 * When it does NOT work: in a strong melt-up it sits in cash much of the time
 * and lags buy-and-hold (defensive). In a choppy sideways market the trend gate
 * flips on/off and it may take fewer trades. In a fast crash that starts from a
 * still-uptrending 50/200, the first dip can still be caught.
 * 2026-05-07: 표시만 바뀜, 매매 판단은 그대로 (ctx.watch 추가)
 */
function onUpdate(ctx) {
  const bb = ctx.bb(20, 2, 1);
  const rsi = ctx.rsi(14, 1);
  const sma50 = ctx.sma(50, 1);
  const sma200 = ctx.sma(200, 1);
  const atr = ctx.atr(14, 1);
  const px = ctx.closes[ctx.closes.length - 2];
  if (bb == null || bb.lower == null || rsi == null || sma50 == null || sma200 == null || atr == null || px == null) {
    ctx.watch([]);
    return null;
  }

  if (ctx.position > 0) {
    ctx.watch([{ side: 'sell', price: bb.mid, trigger: 'above', note: 'BB mid exit' }]);
    if (px >= bb.mid || rsi > 60) return { side: 'sell', qty: ctx.position };
    return null;
  }

  // Strong trend gate: 50 SMA above 200 SMA means a confirmed uptrend, so a dip
  // to the lower band is a pullback, not a falling knife (fixes the 2022-24 bleed).
  ctx.watch([{
    side: 'buy',
    price: bb.lower,
    trigger: 'below',
    note: 'BB lower dip',
    conds: [
      { label: 'RSI(14) close', now: rsi, op: '<', ref: 35, closed: true },
      { label: 'px > SMA200', ok: px > sma200 },
      { label: 'SMA50 > SMA200', ok: sma50 > sma200 }
    ]
  }]);

  if (px <= bb.lower && rsi < 35 && px > sma200 && sma50 > sma200) {
    const equity = ctx.cash + ctx.position * ctx.price;
    const stopDist = 2 * atr;
    const qty = Math.max(0, Math.min((equity * 0.02) / stopDist, (ctx.cash / ctx.price) * 0.95));
    if (qty > 0) return { side: 'buy', qty: qty };
  }
  return null;
}
