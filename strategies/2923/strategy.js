/*
 * @coinsori-strategy v1
 * name: ETH 4H Bollinger MR Deep-Capitulation
 * ex: binance
 * syms: ETHUSDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: ETH overshoots down on fear and snaps back, but shallow
 * dips (RSI 30-35) in a choppy market often keep falling, which is why the plain
 * mean-reversion bleeds in 2022-24. This version only buys TRUE capitulation:
 * RSI below 25, which marks a panic flush that historically snaps back hard.
 * Fewer, higher-quality trades should cut the 2022-24 losses.
 * When it buys and sells: it buys when price closes below the 20-bar lower
 * Bollinger band with RSI below 25 and price above the 200-bar average. It sells
 * when price returns to the middle band or RSI climbs above 60. Size is
 * ATR-scaled (risk 2% on a 2-ATR stop).
 * When it does NOT work: in a slow grind lower without panic flushes it rarely
 * triggers and sits in cash. In a prolonged bear the few capitulation buys can
 * still be early. It lags buy-and-hold in strong melt-ups (defensive).
 *
 * 2026-04-27 표시만 바뀜, 매매 판단은 그대로
 */
function onUpdate(ctx) {
  ctx.watch([]);

  const bb = ctx.bb(20, 2, 1);
  const rsi = ctx.rsi(14, 1);
  const sma200 = ctx.sma(200, 1);
  const atr = ctx.atr(14, 1);
  const px = ctx.closes[ctx.closes.length - 2];
  if (bb == null || bb.lower == null || rsi == null || sma200 == null || atr == null || px == null) return null;

  if (ctx.position > 0) {
    ctx.watch([
      { side: 'sell', price: bb.mid, trigger: 'above', note: 'Mid BB exit' },
      { side: 'sell', note: 'RSI > 60 exit', conds: [{ label: 'RSI(14)', now: rsi, op: '>', ref: 60, closed: true }] }
    ]);

    if (px >= bb.mid || rsi > 60) return { side: 'sell', qty: ctx.position };
    return null;
  }

  ctx.watch([
    {
      side: 'buy',
      price: bb.lower,
      trigger: 'below',
      note: 'Deep capitulation entry',
      conds: [
        { label: 'RSI(14)', now: rsi, op: '<', ref: 25, closed: true },
        { label: 'close > SMA200', now: px, op: '>', ref: sma200, closed: true }
      ]
    }
  ]);

  // Deep-capitulation entry: RSI<25 only buys panic flushes, not shallow chop.
  if (px <= bb.lower && rsi < 25 && px > sma200) {
    const equity = ctx.cash + ctx.position * ctx.price;
    const stopDist = 2 * atr;
    const qty = Math.max(0, Math.min((equity * 0.02) / stopDist, (ctx.cash / ctx.price) * 0.95));
    if (qty > 0) return { side: 'buy', qty: qty };
  }
  return null;
}
