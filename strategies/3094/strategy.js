/*
 * @coinsori-strategy v1
 * name: SOL Hybrid MR + Trend Leg 1D
 * ex: binance
 * syms: SOLUSDT
 * interval: 1d
 * cash: 10000
 *
 * 2025-04-11 표시만 바뀜, 매매 판단은 그대로
 *
 * Why this strategy: the defensive mean-reversion core protects capital in bears but
 * lags badly in melt-ups (+40% vs +1092% hold). This hybrid keeps that protection and
 * ADDS a trend-following leg that rides strong uptrends, so it can capture the bull
 * side the MR misses.
 * When it buys and sells: in a confirmed melt-up (rising 200-day, price above the
 * 50-day and well above the 200-day) it buys pullbacks to the 20-day average and rides
 * with an ATR trailing stop; outside a confirmed uptrend it only buys deep oversold
 * flushes (below lower Bollinger, RSI<30) and sells on a 20-day snap-back.
 * When it does NOT work: in a choppy sideways market the trend leg whipsaws and the
 * MR leg rarely triggers, so it can underperform buy-and-hold in a slow grind up.
 */
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
  const sma50 = ctx.sma(50, 1);
  const sma20 = ctx.sma(20, 1);
  const sma20prev = ctx.sma(20, 2);
  const atr = ctx.atr(14, 1);
  if (bb == null || rsi == null || sma200 == null || sma200prev == null || sma50 == null || sma20 == null || sma20prev == null || atr == null || atr <= 0) {
    ctx.watch([]);
    return null;
  }

  const pos = ctx.position;
  // Confirmed melt-up: 200-day rising, price above the 50-day AND well above 200-day.
  const strongBull = sma200 > sma200prev && price > sma50 && price > sma200 * 1.08;

  if (pos > 0) {
    const peak = ctx.state.peak != null ? Math.max(ctx.state.peak, price) : price;
    ctx.state.peak = peak;
    if (strongBull) {
      // Trend leg exit: 2.5 ATR trail, or trend rolls over.
      ctx.watch([
        { side: 'sell', price: peak - 2.5 * atr, trigger: 'below', note: 'ATR trail' },
        { side: 'sell', price: sma200, trigger: 'below', note: 'trend rollover' }
      ]);
      if (price < peak - 2.5 * atr || price < sma200) {
        ctx.state.peak = null;
        return { side: 'sell', qty: pos };
      }
      return null;
    }
    // Defensive MR exit: snap back to the 20-day average, or trend broke.
    ctx.watch([
      { side: 'sell', price: sma20, trigger: 'above', note: 'MR snap-back' },
      { side: 'sell', price: sma200, trigger: 'below', note: 'trend broke' }
    ]);
    if (price > sma20 || price < sma200) {
      ctx.state.peak = null;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  if (strongBull) {
    // Trend leg: buy a pullback in an uptrend (price dipped to/near the 20-day avg
    // but the trend is intact).
    const pullback = price <= sma20 * 1.02 && sma20 > sma20prev;
    ctx.watch([
      {
        side: 'buy',
        price: sma20 * 1.02,
        trigger: 'below',
        note: 'trend leg pullback',
        conds: [{ label: 'SMA20 rising', ok: sma20 > sma20prev }]
      }
    ]);
    if (pullback) {
      ctx.state.peak = price;
      return { side: 'buy', qty: (ctx.cash / price) * 0.98 };
    }
    return null;
  }

  // Defensive core: deep oversold flush inside a rising long-term trend.
  ctx.watch([
    {
      side: 'buy',
      price: bb.lower,
      trigger: 'below',
      note: 'deep oversold flush',
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
