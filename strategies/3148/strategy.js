/*
 * @coinsori-strategy v1
 * name: SOL 1D Defensive Mean Reversion
 * ex: binance
 * syms: SOLUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Defensive mean-reversion — buy a sharp drop to the lower
 * Bollinger band while the daily trend is still up, ride the snap-back to the
 * 20-day average. The rising-200d gate keeps it out of bear markets and the
 * RSI<30 filter only accepts genuinely oversold dips, avoiding slow bleed.
 * This is the exact config that the ledger validated as the SOL 1D defensive
 * MR champion (reproduces at ~+50%/MDD14 on a fresh window).
 * When it buys and sells: buys when SOL touches the lower Bollinger band AND
 * RSI < 30 AND its 200-day average is rising AND price is above that average.
 * Sells when price recovers above the 20-day EMA or drops below the 200-day
 * average (long-term trend broken).
 * When it does NOT work: in a sustained bear market the rising-200d gate keeps
 * it in cash (misses bounces); it underperforms buy-and-hold in melt-up windows
 * because it exits at the 20-day EMA instead of riding the full trend.
 * 2026-05-09: 표시만 바뀜, 매매 판단은 그대로
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
  const sma200_20ago = ctx.sma(200, 21);
  const ema20 = ctx.ema(20, 1);
  if (bb == null || rsi == null || sma200 == null || sma200_20ago == null || ema20 == null) {
    ctx.watch([]);
    return null;
  }

  const lower = Array.isArray(bb) ? bb[2] : bb.lower;
  if (!Number.isFinite(lower)) {
    ctx.watch([]);
    return null;
  }

  const pos = ctx.position;
  if (pos > 0) {
    ctx.watch([
      { side: 'sell', price: ema20, trigger: 'above', note: 'recovery to EMA20' },
      { side: 'sell', price: sma200, trigger: 'below', note: 'trend broken' }
    ]);
    if (price >= ema20 || price < sma200) {
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  const trendRising = sma200 >= sma200_20ago;
  ctx.watch([
    {
      side: 'buy',
      price: lower,
      trigger: 'below',
      note: 'BB lower band',
      conds: [
        { label: 'RSI(14)', now: rsi, op: '<', ref: 30, closed: true },
        { label: 'price > SMA200', now: price, op: '>', ref: sma200 },
        { label: 'SMA200 rising', ok: trendRising }
      ]
    }
  ]);

  if (price <= lower && rsi < 30 && price > sma200 && trendRising) {
    return { side: 'buy', qty: (ctx.cash / price) * 0.95 };
  }
  return null;
}
