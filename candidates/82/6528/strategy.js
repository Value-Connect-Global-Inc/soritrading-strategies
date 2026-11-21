/*
 * @coinsori-strategy v1
 * name: BTC Macro Risk-On 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Crypto is a high-beta risk asset. When equity-market
 * volatility is calm (VIX below its own 90-day average) and the US equity
 * market is in an uptrend (NASDAQ-100 above its 200-day average), risk appetite
 * is healthy and Bitcoin tends to grind higher. When volatility spikes, risk
 * appetite collapses and Bitcoin tends to fall hard.
 * When it buys and sells: Holds BTC long while the risk-on regime is active
 * (calm VIX + rising NDX). Steps fully to cash when the regime turns risk-off.
 * A hard stop protects against a sudden crash that the daily regime signal is
 * too slow to catch.
 * When it does NOT work: in a crypto bull market that runs while equity vol is
 * still elevated (e.g. a crypto-only rally with no equity confirmation), and in
 * whipsaw periods where VIX crosses its average repeatedly. The daily macro
 * signal lags fast crypto crashes.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const pos = ctx.position || 0;
  if (price == null || price <= 0) { ctx.watch([]); return null; }

  // accumulate daily VIX and NDX history for relative (vs own mean) measures
  const vix = ctx.data("base_vix");
  const ndx = ctx.data("base_ndx");
  const vixHist = ctx.state.vixHist || [];
  const ndxHist = ctx.state.ndxHist || [];
  if (vix != null) { vixHist.push(vix); if (vixHist.length > 210) vixHist.shift(); }
  if (ndx != null) { ndxHist.push(ndx); if (ndxHist.length > 210) ndxHist.shift(); }
  ctx.state.vixHist = vixHist;
  ctx.state.ndxHist = ndxHist;

  // need enough history for the 90-day VIX mean and 200-day NDX average
  if (vixHist.length < 95 || ndxHist.length < 200) { ctx.watch([]); return null; }

  const vixNow = vixHist[vixHist.length - 1];
  const vixMean = vixHist.slice(-90).reduce((a, b) => a + b, 0) / 90;
  const ndxNow = ndxHist[ndxHist.length - 1];
  const ndxSma = ndxHist.slice(-200).reduce((a, b) => a + b, 0) / 200;

  const riskOn = vixNow < vixMean && ndxNow > ndxSma;

  // restart-surviving close when entry price unknown (run started holding)
  if (pos !== 0 && ctx.entryPx == null) {
    ctx.watch([{ side: 'sell', price: price, trigger: 'below', note: 'restart close' }]);
    return { side: 'sell', qty: Math.abs(pos), reduceOnly: true };
  }

  if (ctx.alloc && ctx.alloc.status !== 'ok') { ctx.watch([]); return null; }

  // while holding: exit on risk-off or hard stop (-18% below entry)
  if (pos !== 0) {
    const entry = ctx.entryPx != null ? ctx.entryPx : price;
    const stopPx = entry * 0.82; // hard stop: a single daily crash can exceed the lagged macro signal
    ctx.watch([
      { side: 'sell', price: stopPx, trigger: 'below', note: 'hard stop 18%' },
      { side: 'sell', price: vixNow, trigger: 'above', note: 'risk-off VIX', conds: [{ label: 'VIX > 90d mean', now: vixNow, op: '>', ref: vixMean, closed: true }] }
    ]);
    if (!riskOn || price <= stopPx) {
      return { side: 'sell', qty: Math.abs(pos), reduceOnly: true };
    }
    return null;
  }

  // flat: enter long when risk-on regime is active
  ctx.watch([
    { side: 'buy', price: ndxSma, trigger: 'above', note: 'risk-on enter', conds: [{ label: 'VIX < 90d mean', now: vixNow, op: '<', ref: vixMean, closed: true }, { label: 'NDX > 200d avg', now: ndxNow, op: '>', ref: ndxSma, closed: true }] }
  ]);
  if (riskOn) {
    const qty = (ctx.cash * 0.95) / price;
    if (qty > 0) return { side: 'buy', qty: qty };
  }
  return null;
}
