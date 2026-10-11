/*
 * @coinsori-strategy v1
 * name: SOL Defensive Mean-Reversion 1D
 * ex: binance
 * syms: SOLUSDT
 * interval: 1d
 * cash: 10000
 *
 * 2026-04-27: 표시만 바뀜, 매매 판단은 그대로
 * Why this strategy: SOL tends to snap back up after sharp, oversold panic drops
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
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (price == null || !Number.isFinite(price) || price <= 0) {
    ctx.watch([]);
    return null;
  }

  const bb = ctx.bb(20, 2, 1);
  const rsi = ctx.rsi(14, 1);
  const sma200 = ctx.sma(200, 1);
  const sma200prev = ctx.sma(200, 2);
  const ema20 = ctx.ema(20, 1);
  if (bb == null || rsi == null || sma200 == null || sma200prev == null || ema20 == null) {
    ctx.watch([]);
    return null;
  }

  const pos = ctx.position;

  if (pos > 0) {
    ctx.watch([
      { side: 'sell', price: ema20, trigger: 'above', qty: pos, note: 'recovered above EMA20' },
      { side: 'sell', price: sma200, trigger: 'below', qty: pos, note: 'trend broke' }
    ]);

    // Exit when recovered above the 20-day average, or the long-term trend broke down.
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
      qty: (ctx.cash / price) * 0.98,
      note: 'deep dip BB lower',
      conds: [
        { label: 'RSI(14) close', now: rsi, op: '<', ref: 30, closed: true },
        { label: 'SMA200 rising', ok: sma200 > sma200prev }
      ]
    }
  ]);

  // Entry: only inside a rising 200-day trend, on a deep oversold flush.
  if (sma200 > sma200prev && rsi < 30 && price < bb.lower) {
    return { side: 'buy', qty: (ctx.cash / price) * 0.98 };
  }
  return null;
}
