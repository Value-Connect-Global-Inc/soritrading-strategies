/*
 * @coinsori-strategy v1
 * name: Donchian Trend-Following XRP 1D
 * ex: binance
 * syms: XRPUSDT
 * interval: 1d
 * cash: 10000
 * 2026-04-27: 표시만 바뀜, 매매 판단은 그대로
 *
 * Why this strategy: Daily Donchian channel breakout is a validated trend-following
 * family on BTC/ETH/DOGE/ADA 1d (positive in every walk-forward window). XRP is a
 * fresh mature large-cap with a long liquid daily history — testing whether this
 * trend edge generalizes to a new asset the way band-bounce mean-reversion does.
 * When it buys and sells: buys when price closes above the 55-day high; exits when
 * price closes below the 30-day low (the wide exit rides trends and avoids
 * whipsawing out of healthy daily pullbacks).
 * When it does NOT work: choppy/range-bound regimes where false breakouts reverse;
 * high drawdown (43-58%) is inherent to daily trend-following; lags in late-cycle
 * reversals because the wide exit gives back gains before triggering.
 */
function onUpdate(ctx) {
  const hi55 = ctx.high(55, 1);
  const lo30 = ctx.low(30, 1);
  if (hi55 == null || lo30 == null) { ctx.watch([]); return null; }

  const price = ctx.price;
  const pos = ctx.position;

  if (pos > 0) {
    ctx.watch([{ side: 'sell', price: lo30, trigger: 'below', note: '30-day low exit' }]);
    if (price < lo30) {
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) { ctx.watch([]); return null; }

  ctx.watch([{ side: 'buy', price: hi55, trigger: 'above', note: '55-day high breakout', conds: [{ label: 'price >= SMA200', now: price, op: '>=', ref: sma200 }] }]);
  if (price < sma200) return null;

  if (price > hi55) {
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.98 };
  }
  return null;
}
