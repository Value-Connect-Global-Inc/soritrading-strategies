/*
 * @coinsori-strategy v1
 * name: BTC Dollar-Regime Trend 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: BTC trades like a high-beta dollar-risk asset — a strengthening US dollar
 * (tightening global liquidity) is a headwind, a weakening dollar a tailwind. It follows the BTC
 * 200-day trend but only takes risk when the broad dollar index is NOT in an uptrend, so it should
 * sit out the worst liquidity-driven drawdowns (like 2022).
 * When it buys and sells: buys when BTC is above its 200-day average AND the dollar index is below
 * its 60-day average; sells when BTC falls below its 200-day average, when the dollar index climbs
 * above its 60-day average, or on a -20% stop from entry.
 * When it does NOT work: when BTC rallies while the dollar also firms (a crypto-specific bull run),
 * it stays in cash and misses the gains. The 60-day dollar filter is slow, so a sudden one-week
 * crash is only caught by the -20% stop.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const cash = ctx.cash;
  const pos = ctx.position;

  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;

  // --- dollar regime from a state ring buffer (dxy is daily, business days only) ---
  let dxy = ctx.data("dxy");
  if (dxy == null) dxy = ctx.state.lastDxy; // carry last known dollar value over weekends
  if (dxy == null) return null; // no dollar data yet — cannot judge regime
  ctx.state.lastDxy = dxy;
  const hist = ctx.state.dxyHist || [];
  hist.push(dxy);
  if (hist.length > 60) hist.shift();
  ctx.state.dxyHist = hist;
  if (hist.length < 20) return null; // warm up the 60-day dollar filter
  const dxySma = hist.reduce((a, b) => a + b, 0) / hist.length;

  const trendUp = price > sma200;
  const dollarUp = dxy > dxySma; // dollar above its own 60-day average = risk-off

  if (pos > 0) {
    const stopPx = ctx.entryPx != null ? ctx.entryPx * 0.8 : null;
    ctx.watch([
      { side: 'sell', price: sma200, trigger: 'below', note: 'BTC broke 200d avg' },
      { side: 'sell', price: dxySma, trigger: 'above', note: 'Dollar strengthening' },
      ...(stopPx != null ? [{ side: 'sell', price: stopPx, trigger: 'below', note: '-20% stop' }] : [])
    ]);
    if (stopPx != null && price <= stopPx) return { side: 'sell', qty: pos, reduceOnly: true };
    if (!trendUp || dollarUp) return { side: 'sell', qty: pos, reduceOnly: true };
    return null; // keep holding
  }

  ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'BTC above 200d avg',
    conds: [{ label: 'Dollar below 60d avg', ok: !dollarUp }] }]);
  if (trendUp && !dollarUp) {
    return { side: 'buy', qty: (cash / price) * 0.98 }; // 2% buffer for fees
  }
  return null;
}
