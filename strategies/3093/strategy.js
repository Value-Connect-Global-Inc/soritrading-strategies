/*
 * @coinsori-strategy v1
 * name: SOL Trend-Ride Momentum 1D
 * ex: binance
 * syms: SOLUSDT
 * interval: 1d
 * cash: 10000
 * 2026-04-27 표시만 바뀜, 매매 판단은 그대로
 *
 * Why this strategy: the defensive mean-reversion idea protects capital in bears but
 * lags badly in melt-ups. This is the opposite family — momentum/trend following —
 * that rides strong uptrends and lets winners run with a trailing stop.
 * When it buys and sells: buys only when the 200-day trend is up AND price is above
 * its 50-day average AND short-term momentum is strong (price at/near its 20-day
 * high); sells when price closes below the 50-day average or drops 2.5 ATR from its
 * running peak.
 * When it does NOT work: in a chop/sideways or sharp bear regime it still buys late
 * and gives back gains; it needs a real sustained directional move to pay off.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) {
    ctx.watch([]);
    return null;
  }

  // Closed-bar reads so backtest and live behave identically.
  const sma200 = ctx.sma(200, 1);
  const sma200prev = ctx.sma(200, 2);
  const sma50 = ctx.sma(50, 1);
  const high20 = ctx.high(20, 1); // highest high of last 20 bars
  const atr = ctx.atr(14, 1);
  if (sma200 == null || sma200prev == null || sma50 == null || high20 == null || atr == null || atr <= 0) {
    ctx.watch([]);
    return null;
  }

  const pos = ctx.position;

  if (pos > 0) {
    // Trailing stop anchored to the highest close since entry.
    const peak = ctx.state.peak != null ? Math.max(ctx.state.peak, price) : price;
    ctx.state.peak = peak;
    const stop = peak - 2.5 * atr;
    ctx.watch([
      { side: 'sell', price: stop, trigger: 'below', note: 'trailing stop 2.5 ATR' },
      { side: 'sell', price: sma50, trigger: 'below', note: 'SMA50 close exit' }
    ]);
    // 2.5 ATR trail (tighter than before to cut drawdown); closing below SMA50 flips out.
    if (price < peak - 2.5 * atr || price < sma50) {
      ctx.state.peak = null;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  // Strong trend gate: 200-day rising ON TOP of a rising 50-day, price above both.
  // Momentum: price within 1.5% of the 20-day high shows a fresh confirmed push.
  const uptrend = sma200 > sma200prev && price > sma50 && price > sma200;
  const momentum = price >= high20 * 0.985;
  const entryPrice = high20 * 0.985;
  ctx.watch([
    {
      side: 'buy',
      price: entryPrice,
      trigger: 'above',
      note: 'momentum entry',
      conds: [
        { label: 'SMA200 rising', ok: sma200 > sma200prev },
        { label: 'price>SMA50', now: price, op: '>', ref: sma50 },
        { label: 'price>SMA200', now: price, op: '>', ref: sma200 }
      ]
    }
  ]);
  if (uptrend && momentum) {
    ctx.state.peak = price;
    return { side: 'buy', qty: (ctx.cash / price) * 0.98 };
  }
  return null;
}
