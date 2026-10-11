/*
 * @coinsori-strategy v1
 * name: SOL Defensive MR ATR-Trail 1D
 * ex: binance
 * syms: SOLUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: same defensive dip-buying idea as the base SOL MR, but exits
 * with an ATR-trailing stop instead of a fixed EMA20 snap-back. The ledger showed
 * an ATR trail cuts drawdown and lets winners run on the multi-asset basket.
 * When it buys and sells: buys on a deep oversold flush (below lower Bollinger,
 * RSI very oversold) inside a rising 200-day trend; sells when price falls 2.5 ATR
 * below the highest close since entry, or the long-term trend rolls over.
 * When it does NOT work: in a straight-line melt-up it stays flat and lags
 * buy-and-hold; the trail can whipsaw an early volatile recovery.
 */
// 2026-04-26 표시만 바뀜, 매매 판단은 그대로
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) {
    ctx.watch([]);
    return null;
  }

  const bb = ctx.bb(20, 2, 1);
  const rsi = ctx.rsi(14, 1);
  const sma200 = ctx.sma(200, 1);
  const sma200prev = ctx.sma(200, 2);
  const atr = ctx.atr(14, 1);
  if (bb == null || rsi == null || sma200 == null || sma200prev == null || atr == null || atr <= 0) {
    ctx.watch([]);
    return null;
  }

  const pos = ctx.position;

  if (pos > 0) {
    // Track the highest close since entry so the trail anchors to the real peak.
    const peak = ctx.state.peak != null ? Math.max(ctx.state.peak, price) : price;
    ctx.state.peak = peak;
    const trailStop = peak - 2.5 * atr; // 2.5 ATR below peak: let winners run, cut reversals
    ctx.watch([
      { side: 'sell', price: trailStop, trigger: 'below', note: 'ATR trail stop' },
      { side: 'sell', price: sma200, trigger: 'below', note: 'SMA200 trend exit' }
    ]);
    if (price < trailStop || price < sma200) {
      ctx.state.peak = null;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  ctx.watch([
    {
      side: 'buy',
      price: bb.lower,
      trigger: 'below',
      note: 'BB lower dip',
      conds: [
        { label: 'RSI(14) close', now: rsi, op: '<', ref: 30, closed: true },
        { label: 'SMA200 rising', ok: sma200 > sma200prev }
      ]
    }
  ]);

  if (sma200 > sma200prev && rsi < 30 && price < bb.lower) {
    ctx.state.peak = price;
    return { side: 'buy', qty: (ctx.cash / price) * 0.98 };
  }
  return null;
}
