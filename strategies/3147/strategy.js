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
 * 20-day average. Validated in the ledger on SOL 1d across three disjoint
 * windows (positive everywhere, low drawdown). Adds a 1d asset to a portfolio
 * of 4h mean-reversion legs and the ADA trend leg.
 * When it buys and sells: buys when SOL touches the lower Bollinger band AND
 * RSI < 30 AND its 200-day average is rising AND today's volume is at least
 * 1.3x the 20-day average (confirmation the drop is real, not a quiet drift).
 * Sells when price recovers above the 20-day EMA or drops below the 200-day
 * average (trend broken).
 * When it does NOT work: in a sustained bear market the rising-200d gate keeps
 * it in cash (misses bounces); it underperforms buy-and-hold in melt-up windows
 * because it exits at the 20-day EMA instead of riding the full trend.
 *
 * Updated: 2025-04-27 — added ctx.watch declarations (표시만 바뀜, 매매 판단은 그대로)
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const bb = ctx.bb(20, 2, 1);
  const rsi = ctx.rsi(14, 1);
  const sma200 = ctx.sma(200, 1);
  const sma200_20ago = ctx.sma(200, 21);
  const ema20 = ctx.ema(20, 1);
  const avgVol = ctx.avgVol(20);
  const vol = ctx.vol;
  if (bb == null || rsi == null || sma200 == null || sma200_20ago == null || ema20 == null || avgVol == null || vol == null) return null;

  const lower = Array.isArray(bb) ? bb[2] : bb.lower;
  if (!Number.isFinite(lower)) return null;

  const pos = ctx.position;
  if (pos > 0) {
    ctx.watch([
      { side: 'sell', price: ema20, trigger: 'above', note: 'recovery to EMA20' },
      { side: 'sell', price: sma200, trigger: 'below', note: 'trend break' }
    ]);
    // Exit on recovery to EMA20, or if the long-term trend broke (price below 200d avg)
    if (price >= ema20 || price < sma200) {
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  const trendRising = sma200 >= sma200_20ago;
  const volConfirms = vol >= 1.3 * avgVol;
  // Volume gate 1.3x: ledger 1742/1743 showed 1.2-1.5x improved the champion; 1.3x is a middle ground.
  ctx.watch([
    {
      side: 'buy',
      price: lower,
      trigger: 'below',
      note: 'BB lower band + trend/volume',
      conds: [
        { label: 'RSI(14) < 30', now: rsi, op: '<', ref: 30, closed: true },
        { label: 'price > SMA200', now: price, op: '>', ref: sma200 },
        { label: 'SMA200 rising', ok: trendRising },
        { label: 'vol >= 1.3x avg', now: vol, op: '>=', ref: 1.3 * avgVol }
      ]
    }
  ]);
  if (price <= lower && rsi < 30 && price > sma200 && trendRising && volConfirms) {
    return { side: 'buy', qty: (ctx.cash / price) * 0.95 };
  }
  return null;
}
