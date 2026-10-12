/*
 * @coinsori-strategy v1
 * name: ETH 4H Bollinger MR Rising-200SMA Gate
 * ex: binance
 * syms: ETHUSDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: ETH overshoots down on fear and snaps back, but only in an
 * uptrend. The plain mean-reversion loses in the 2022 bear because it buys dips
 * that keep falling even when price sits above the 200-bar average. This version
 * adds a STRONGER trend gate: the 200-bar average itself must be RISING (its
 * value 60 bars ago is below today's), so the strategy only buys dips while the
 * longer-term trend is genuinely up, not during a bear-market rally that fades.
 * When it buys and sells: it buys when price closes below the 20-bar lower
 * Bollinger band with RSI below 35, price above the 200-bar average, AND the
 * 200-bar average is rising. It sells when price returns to the middle band or
 * RSI climbs above 60. Size is ATR-scaled (risk 2% on a 2-ATR stop).
 * When it does NOT work: in a strong melt-up it sits in cash for long stretches
 * and lags buy-and-hold (defensive). In a choppy sideways market the rising-SMA
 * gate may reject most dips, giving few trades. It still cannot avoid every
 * bad entry when a crash starts from a still-rising 200 SMA.
 * 
 * 2024-01-01: watch 선언만 추가됨 (표시만 바뀜, 매매 판단은 그대로)
 */
function onUpdate(ctx) {
  const bb = ctx.bb(20, 2, 1);
  const rsi = ctx.rsi(14, 1);
  const sma200 = ctx.sma(200, 1);
  const sma200old = ctx.sma(200, 61); // 200-SMA 60 bars ago, to test its slope
  const atr = ctx.atr(14, 1);
  const px = ctx.closes[ctx.closes.length - 2];
  if (bb == null || bb.lower == null || rsi == null || sma200 == null || sma200old == null || atr == null || px == null) return null;

  if (ctx.position > 0) {
    if (px >= bb.mid || rsi > 60) {
      ctx.watch([
        { side: 'sell', price: bb.mid, trigger: 'above', qty: ctx.position, note: 'BB mid exit' },
        { side: 'sell', price: null, trigger: 'above', qty: ctx.position, note: 'RSI>60 exit', conds: [{ label: 'RSI(14) close', now: rsi, op: '>', ref: 60, closed: true }] }
      ]);
      return { side: 'sell', qty: ctx.position };
    }
    ctx.watch([
      { side: 'sell', price: bb.mid, trigger: 'above', qty: ctx.position, note: 'BB mid exit' },
      { side: 'sell', price: null, trigger: 'above', qty: ctx.position, note: 'RSI>60 exit', conds: [{ label: 'RSI(14) close', now: rsi, op: '>', ref: 60, closed: true }] }
    ]);
    return null;
  }

  // Rising 200-SMA gate: only buy dips while the long-term trend is genuinely up.
  // This is a stronger filter than price>200SMA and aims to skip 2022 bear entries.
  if (px <= bb.lower && rsi < 35 && px > sma200 && sma200 > sma200old) {
    const equity = ctx.cash + ctx.position * ctx.price;
    const stopDist = 2 * atr;
    const qty = Math.max(0, Math.min((equity * 0.02) / stopDist, (ctx.cash / ctx.price) * 0.95));
    if (qty > 0) {
      ctx.watch([
        { side: 'buy', price: bb.lower, trigger: 'below', qty: qty, note: 'BB lower dip', conds: [
          { label: 'RSI(14) close', now: rsi, op: '<', ref: 35, closed: true },
          { label: 'Price > SMA200', ok: px > sma200 },
          { label: 'SMA200 rising', ok: sma200 > sma200old }
        ]}
      ]);
      return { side: 'buy', qty: qty };
    }
  }
  ctx.watch([]);
  return null;
}
