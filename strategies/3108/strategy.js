/*
 * @coinsori-strategy v1
 * name: SOL 1D Defensive MR (EMA20 exit) — champion recipe
 * ex: binance
 * syms: SOLUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: This is the ledger's validated SOL 1D defensive mean-reversion
 * champion (exp 1721, +106% full span / MDD19). It buys deep oversold dips inside a rising
 * 200-day trend and exits when price recovers back above the 20-day EMA — a clean snap-back
 * that captures the mean-reversion move without holding losers. Rebuilt here as a baseline to
 * confirm it reproduces on this data before testing improvements.
 * When it buys and sells: buy when price closes below the lower Bollinger (20,2) with
 * RSI(14)<30, only while the 200-day average is rising. Sell when price closes back above the
 * 20-day EMA or when the 200-day trend turns down.
 * When it does NOT work: in a straight-line melt-up it exits on every EMA20 snap-back and
 * re-enters, so it lags buy-and-hold badly; in a broad coordinated bear the rising-trend gate
 * keeps it flat (safe but no upside). The EMA20 exit can whipsaw a choppy recovery.
 * 2026-01-01 표시만 바뀜, 매매 판단은 그대로
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
  const ema20 = ctx.ema(20, 1);
  if (bb == null || rsi == null || sma200 == null || sma200prev == null || ema20 == null) {
    ctx.watch([]);
    return null;
  }

  const uptrend = sma200 > sma200prev;
  const pos = ctx.position;

  if (pos > 0) {
    // Snap-back exit: price recovered above the 20-day EMA, or the long trend broke.
    ctx.watch([
      { side: 'sell', price: ema20, trigger: 'above', note: 'EMA20 snap-back' },
      { side: 'sell', note: '200-day trend break', conds: [{ label: 'SMA200 rising', ok: uptrend }] }
    ]);
    if (price > ema20 || !uptrend) {
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  // No position: wait for a deep oversold dip inside a rising 200-day trend.
  ctx.watch([
    {
      side: 'buy',
      price: bb.lower,
      trigger: 'below',
      note: 'BB lower dip',
      conds: [
        { label: 'RSI(14) close', now: rsi, op: '<', ref: 30, closed: true },
        { label: 'SMA200 rising', ok: uptrend }
      ]
    }
  ]);

  if (!uptrend) return null;

  const flush = price < bb.lower && rsi < 30; // deep oversold dip inside an uptrend
  if (flush) {
    const qty = (ctx.cash / price) * 0.99;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
