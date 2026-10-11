/*
 * @coinsori-strategy v1
 * name: SOL Defensive Mean Reversion 1D
 * ex: binance
 * syms: SOLUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: when the long-term uptrend is still intact, a deep fear-driven
 * crash usually mean-reverts. This bets on that, buying only in panic and holding
 * mostly cash otherwise, so it protects capital in bear markets instead of chasing.
 * When it buys and sells: buys only when the 200-day trend is rising AND price is
 * below the lower Bollinger band AND RSI is very oversold (<30); sells when price
 * recovers above the 20-day average or the 200-day trend rolls over.
 * When it does NOT work: in a straight-line melt-up it stays mostly in cash and lags
 * buy-and-hold; it needs occasional deep dips to buy, so a relentless rally gives
 * few entries.
 * 2026-04-27 표시만 바뀜, 매매 판단은 그대로
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  // Closed-bar reads so backtest and live behave identically.
  const bb = ctx.bb(20, 2, 1);
  const rsi = ctx.rsi(14, 1);
  const sma200 = ctx.sma(200, 1);
  const sma200prev = ctx.sma(200, 2);
  const ema20 = ctx.ema(20, 1);
  if (bb == null || rsi == null || sma200 == null || sma200prev == null || ema20 == null) return null;

  const pos = ctx.position;

  if (pos > 0) {
    ctx.watch([
      { side: 'sell', price: ema20, trigger: 'above', note: 'exit above EMA20' },
      { side: 'sell', price: sma200, trigger: 'below', note: 'exit below SMA200' }
    ]);

    // Exit: recovered above the 20-day average, or the long-term trend rolled over.
    if (price > ema20 || price < sma200) {
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  ctx.watch([
    {
      side: 'buy',
      price: bb.lower,
      trigger: 'below',
      note: 'deep oversold buy zone',
      conds: [
        { label: 'SMA200 rising', ok: sma200 > sma200prev },
        { label: 'RSI(14) < 30', now: rsi, op: '<', ref: 30, closed: true }
      ]
    }
  ]);

  // Buy only a deep oversold flush inside a rising long-term trend.
  if (sma200 > sma200prev && rsi < 30 && price < bb.lower) {
    return { side: 'buy', qty: (ctx.cash / price) * 0.98 };
  }
  return null;
}
