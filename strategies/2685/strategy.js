/*
 * @coinsori-strategy v1
 * name: Squeeze Breakout SOL 4H v3 trail
 * ex: binance
 * syms: SOLUSDT
 * interval: 4h
 * cash: 10000
 *
 * 2026-04-27: 표시만 바뀜, 매매 판단은 그대로
 *
 * Why this strategy: Volatility contraction builds energy for a breakout. This
 * version keeps the relative-compression entry from v2 but replaces the tight
 * mid-band exit with a 3x-ATR trailing stop (the exit that made the volume-surge
 * breakout family work on SOL) so winners can run.
 * When it buys and sells: buys when the 20-2 Bollinger width is compressed to
 * ~65% of its rolling average AND price closes above the upper band on
 * above-average volume. Exits on a 3x-ATR trailing stop from the peak.
 * When it does NOT work: in persistent downtrends the squeeze resolves downward
 * and the upper-band entry fires into a falling market; the ATR trail can give
 * back a large run in a sharp reversal. Needs genuine post-squeeze expansion.
 */
function onUpdate(ctx) {
  const bb = ctx.bb(20, 2, 1);
  if (bb == null) {
    ctx.watch([]);
    return null;
  }
  const price = ctx.price;
  const pos = ctx.position;

  if (pos > 0) {
    const atr = ctx.atr(14, 1);
    if (atr == null) {
      ctx.watch([]);
      return null;
    }
    // Trailing stop: track the highest price since entry; exit when price falls
    // 3x ATR below that peak. Lets winners run, cuts losers short.
    const peak = Math.max(ctx.state.peak || ctx.entryPx, price);
    ctx.state.peak = peak;
    ctx.watch([{
      side: 'sell',
      price: peak - atr * 3,
      trigger: 'below',
      qty: pos,
      note: '3x ATR trail stop'
    }]);
    if (price <= peak - atr * 3) {
      ctx.state.lastExit = ctx.i;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  const lastExit = ctx.state.lastExit || 0;
  if (ctx.i - lastExit < 5) {
    ctx.watch([{
      side: 'buy',
      price: bb.upper,
      trigger: 'above',
      note: 'Squeeze breakout',
      conds: [{ label: 'cooldown 5 bars since exit', ok: ctx.i - lastExit >= 5 }]
    }]);
    return null;
  }

  const width = (bb.upper - bb.lower) / bb.mid;
  let wAvg = ctx.state.wAvg;
  if (wAvg == null) wAvg = width;
  else wAvg = wAvg * 0.95 + width * 0.05;
  ctx.state.wAvg = wAvg;
  if (wAvg <= 0) {
    ctx.watch([{
      side: 'buy',
      price: bb.upper,
      trigger: 'above',
      note: 'Squeeze breakout',
      conds: [
        { label: 'width <= wAvg*0.65', now: width, op: '<=', ref: wAvg * 0.65 },
        { label: 'cooldown 5 bars since exit', ok: true }
      ]
    }]);
    return null;
  }

  const vol = ctx.vol;
  const avgVol = ctx.avgVol(20);
  if (vol == null || avgVol == null) {
    ctx.watch([{
      side: 'buy',
      price: bb.upper,
      trigger: 'above',
      note: 'Squeeze breakout',
      conds: [
        { label: 'width <= wAvg*0.65', now: width, op: '<=', ref: wAvg * 0.65 },
        { label: 'cooldown 5 bars since exit', ok: true }
      ]
    }]);
    return null;
  }
  if (vol < avgVol * 1.2) {
    ctx.watch([{
      side: 'buy',
      price: bb.upper,
      trigger: 'above',
      note: 'Squeeze breakout',
      conds: [
        { label: 'width <= wAvg*0.65', now: width, op: '<=', ref: wAvg * 0.65 },
        { label: 'volume >= 1.2x avg', now: vol, op: '>=', ref: avgVol * 1.2 },
        { label: 'cooldown 5 bars since exit', ok: true }
      ]
    }]);
    return null;
  }

  ctx.watch([{
    side: 'buy',
    price: bb.upper,
    trigger: 'above',
    note: 'Squeeze breakout',
    conds: [
      { label: 'width <= wAvg*0.65', now: width, op: '<=', ref: wAvg * 0.65 },
      { label: 'volume >= 1.2x avg', now: vol, op: '>=', ref: avgVol * 1.2 },
      { label: 'cooldown 5 bars since exit', ok: true }
    ]
  }]);
  if (width <= wAvg * 0.65 && price > bb.upper) {
    ctx.state.peak = price;
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.95 };
  }
  return null;
}
