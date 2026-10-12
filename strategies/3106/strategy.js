/*
 * @coinsori-strategy v1
 * name: BTC 1D Defensive Mean-Reversion (trend-gated)
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: BTC tends to snap back up after sharp, oversold panic drops
 * when its long-term trend is still intact. Buying those deep dips and selling
 * after a recovery is a defensive way to profit without chasing melt-ups.
 * When it buys and sells: it buys only when price closes below the lower Bollinger
 * band with RSI very oversold, and only while the 200-day average is still rising.
 * It sells once price climbs back above its 20-day average (recovered) or the
 * long-term trend rolls over.
 * When it does NOT work: in a straight-line melt-up it stays mostly flat (few deep
 * dips to buy) and lags buy-and-hold; in a sustained bear the trend gate keeps it
 * in cash so it protects capital but earns little. It is defensive, not a momentum
 * winner.
 *
 * 2024-01-01: 표시만 바뀜, 매매 판단은 그대로
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const bb = ctx.bb(20, 2, 1);
  const rsi = ctx.rsi(14, 1);
  const sma200 = ctx.sma(200, 1);
  const sma200prev = ctx.sma(200, 2);
  const ema20 = ctx.ema(20, 1);
  if (bb == null || rsi == null || sma200 == null || sma200prev == null || ema20 == null) return null;

  const pos = ctx.position;

  if (pos > 0) {
    // Exit when recovered above the 20-day average, or the long-term trend broke down.
    ctx.watch([
      { side: 'sell', price: ema20, trigger: 'above', note: '20-day avg recovery', conds: [{ label: 'Price below SMA200', now: price, op: '>', ref: sma200, closed: false }] },
      { side: 'sell', price: sma200, trigger: 'below', note: 'Trend breakdown', conds: [{ label: 'Price above EMA20', now: price, op: '<', ref: ema20, closed: false }] }
    ]);
    if (price > ema20 || price < sma200) {
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  // Entry: only inside a rising 200-day trend, on a deep oversold flush.
  ctx.watch([
    { side: 'buy', price: bb.lower, trigger: 'below', note: 'BB lower touch', conds: [
      { label: 'RSI(14) close', now: rsi, op: '<', ref: 30, closed: true },
      { label: 'SMA200 rising', ok: sma200 > sma200prev }
    ]}
  ]);
  if (sma200 > sma200prev && rsi < 30 && price < bb.lower) {
    return { side: 'buy', qty: (ctx.cash / price) * 0.98 };
  }
  return null;
}
