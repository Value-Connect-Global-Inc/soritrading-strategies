/*
 * @coinsori-strategy v1
 * name: BTC OBV Trend Ride 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The OBV champion protects capital in bears but its strict volume
 * gate blocked bull entries (the ledger showed a volume gate cuts bull gains in half).
 * On-Balance Volume tracks whether money flows in or out over time: a rising OBV
 * trend with price above the 200-day average confirms an accumulation-driven uptrend.
 * This version drops the per-bar volume confirmation so it rides more of the bull,
 * while the SMA200 gate keeps it out of bear markets.
 * When it buys and sells: Buys when smoothed OBV is clearly rising vs 30 days earlier
 * AND price is above its 200-day average. Sells when smoothed OBV turns down, price
 * closes below the 200-day average, or a 25% disaster stop from entry.
 * When it does NOT work: OBV can diverge from price for long stretches in choppy
 * sideways markets, causing whipsaw; it lags sharp V-shaped melt-ups where volume
 * spikes before the 30-day average catches up; a single straight-line melt-up still
 * lags buy-and-hold.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;

  const closes = ctx.closes;
  const vols = ctx.volumes;
  if (!closes || !vols || closes.length < 32) return null;

  let obv = 0;
  const obvSeries = [];
  for (let k = 1; k < closes.length; k++) {
    const c = closes[k], p = closes[k - 1], v = vols[k];
    if (!Number.isFinite(c) || !Number.isFinite(p) || !Number.isFinite(v)) continue;
    if (c > p) obv += v;
    else if (c < p) obv -= v;
    obvSeries.push(obv);
  }
  if (obvSeries.length < 32) return null;
  const obvNow = obvSeries[obvSeries.length - 1];
  const obvPast = obvSeries[obvSeries.length - 31];

  // Hysteresis band: 0.8% to cut whipsaw without blocking bull entries.
  const rising = obvNow > obvPast * 1.008;
  const falling = obvNow < obvPast * 0.992;

  const st = ctx.state;
  let cd = st.cd || 0;
  if (cd > 0) cd--;
  ctx.state.cd = cd;

  const pos = ctx.position;
  if (pos > 0) {
    const disaster = ctx.entryPx != null ? ctx.entryPx * 0.75 : null; // 25% disaster stop
    ctx.watch([
      { side: 'sell', price: sma200, trigger: 'below', note: 'SMA200 break' },
      { side: 'sell', price: disaster, trigger: 'below', note: '25% disaster stop' }
    ]);
    if (falling && cd === 0) { ctx.state.cd = 5; return { side: 'sell', qty: pos, reduceOnly: true }; }
    if (price < sma200) { ctx.state.cd = 5; return { side: 'sell', qty: pos, reduceOnly: true }; }
    if (disaster != null && price < disaster) { ctx.state.cd = 5; return { side: 'sell', qty: pos, reduceOnly: true }; }
    return null;
  }

  if (rising && price > sma200 && cd === 0) {
    ctx.state.cd = 5;
    const qty = (0.95 * ctx.cash) / price * 0.99;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
