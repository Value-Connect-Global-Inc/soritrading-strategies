/*
 * @coinsori-strategy v1
 * name: BTC 1D VIX-Regime Trend
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: BTC's long-term trend is real, but its worst drawdowns come
 * when fear spikes (VIX). The CBOE VIX measures expected US equity volatility — a
 * clean macro risk-on/risk-off gauge that price alone cannot see. We ride the
 * 200-day trend and step aside when VIX spikes above 30 (extreme fear).
 * When it buys and sells: long when price is above its 200-day average AND VIX is
 * below 30; sells when price closes below the 200-day average OR VIX closes above 30.
 * When it does NOT work: it misses the first leg of a melt-up right after a fear
 * spike (VIX stays high while price already recovers), and it is only as good as
 * the 200-day trend — choppy ranges around the SMA still whipsaw.
 */
function onUpdate(ctx) {
  const pos = ctx.position;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;

  const vix = ctx.data('base_vix'); // FRED CBOE VIX, lagged 2d — no look-ahead
  if (vix == null || !Number.isFinite(vix)) return null;

  const st = ctx.state;
  let cd = st.cd || 0;
  if (cd > 0) cd--;
  ctx.state.cd = cd;

  if (pos > 0) {
    const stop = st.stop;
    const low = ctx.low(0);
    const watchArr = [
      { side: 'sell', price: sma200, trigger: 'below', note: 'Trend break', conds: [{ label: 'VIX', now: vix, op: '>', ref: 30, closed: true }] }
    ];
    if (stop != null) watchArr.push({ side: 'sell', price: stop, trigger: 'below', note: 'Hard stop -8%' });
    ctx.watch(watchArr);
    if (price < sma200 || vix > 30) {
      ctx.state.cd = 5;
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    if (stop != null && low < stop) {
      ctx.state.cd = 5;
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  const uptrend = price > sma200;
  const calm = vix < 30; // 30 = classic "extreme fear" VIX level; above it markets are stressed
  ctx.watch([
    { side: 'buy', price: sma200, trigger: 'above', note: 'SMA200 re-cross', conds: [
      { label: 'VIX < 30', now: vix, op: '<', ref: 30, closed: true }
    ]}
  ]);
  if (uptrend && calm && cd === 0) {
    if (ctx.alloc.status !== 'ok') return null;
    ctx.state.cd = 5;
    ctx.state.stop = price * 0.92; // 8% hard stop on every position
    return { side: 'buy', qty: ctx.cash / price * 0.95 };
  }
  return null;
}
