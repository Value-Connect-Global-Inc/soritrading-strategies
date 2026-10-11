/*
 * @coinsori-strategy v1
 * name: BTC Defensive Mean Reversion
 * ex: upbit
 * syms: BTC
 * interval: 4h
 * cash: 10000000
 *
 * Why this strategy: On BTC, sharp flush-downs into oversold territory tend to
 * bounce (mean reversion) while the long-term trend is intact. Trend-following
 * and momentum consistently fail on BTC, but defensive buy-the-dip works and
 * holds drawdown low.
 *
 * When it buys and sells: It buys when price is pushed deep below the
 * Bollinger band AND RSI is very oversold, but only while the 200-period
 * average is still rising (so we never catch a falling knife in a bear).
 * It sells when price recovers back above the 20-period average.
 *
 * When it does NOT work: It stays flat (no return) during strong melt-up
 * rallies because those never dip into the buy zone, and it underperforms
 * buy-and-hold in those periods. It also sits out long bear markets.
 */
// 2025-04-08 표시만 바뀜, 매매 판단은 그대로
function onUpdate(ctx) {
  const price = ctx.price;
  if (price == null) {
    ctx.watch([]);
    return null;
  }

  // Long-term trend gate: only buy while the 200-period average is rising.
  const sma200 = ctx.sma(200, 1);
  const sma200prev = ctx.sma(200, 2);
  if (sma200 == null || sma200prev == null) {
    ctx.watch([]);
    return null;
  }
  const uptrend = sma200 > sma200prev;

  // Bollinger band (20, 2) from the previous closed bar.
  const bb = ctx.bb(20, 2, 1);
  if (bb == null) {
    ctx.watch([]);
    return null;
  }

  const rsi = ctx.rsi(14, 1);
  const sma20 = ctx.sma(20, 1);
  if (rsi == null || sma20 == null) {
    ctx.watch([]);
    return null;
  }

  // If we are not holding, look for a flush-down entry.
  if (ctx.position <= 0) {
    ctx.watch([
      {
        side: 'buy',
        price: bb.lower,
        trigger: 'below',
        note: 'BB lower + RSI oversold',
        conds: [
          { label: 'RSI(14) close', now: rsi, op: '<', ref: 30, closed: true },
          { label: 'SMA200 rising', ok: uptrend }
        ]
      }
    ]);

    // Buy only when deeply oversold AND below the lower band AND trend rising.
    const oversold = rsi < 30 && price < bb.lower;
    if (uptrend && oversold) {
      return { side: 'buy', qty: ctx.cash / price * 0.99 };
    }
    return null;
  }

  // Exit: price recovered back above the 20-period average.
  ctx.watch([
    { side: 'sell', price: sma20, trigger: 'above', note: 'Exit above SMA20' }
  ]);
  if (price > sma20) {
    return { side: 'sell', qty: ctx.position };
  }
  return null;
}
