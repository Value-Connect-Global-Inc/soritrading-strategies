/*
 * @coinsori-strategy v1
 * name: BTC Macro Risk-On Regime 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin's long-term trend is driven by the global risk/liquidity regime. When the dollar is weakening, volatility is contained and the yield curve is not deeply inverted, BTC's uptrend tends to be sustainable; when risk-off hits, BTC tends to crash.
 * When it buys and sells: It buys when price is above its 200-day average AND the broad dollar is below its own recent average AND VIX is under 30 AND the 10Y-2Y curve is above -0.5%. It sells when price closes below the 200-day average or falls 20% below entry as a disaster stop.
 * When it does NOT work: In a bull market that runs against a strong dollar or with elevated volatility, it stays out and misses gains. Macro signals lag price, so it can exit late in fast crashes and re-enter late in V-shaped recoveries.
 */
function onUpdate(ctx) {
  const sma200 = ctx.sma(200, 1);
  const vix = ctx.data("base_vix");
  const curve = ctx.data("base_t10y2y");
  const dxy = ctx.data("base_usd_broad");
  if (sma200 == null || vix == null || curve == null || dxy == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  // Dollar trend: current dollar below its own recent 50-bar average = risk-on for BTC
  const dhist = ctx.state.dxyHist || [];
  dhist.push(dxy);
  if (dhist.length > 50) dhist.shift();
  ctx.state.dxyHist = dhist;
  const prior = dhist.slice(0, -1);
  const dxyAvg = prior.length ? prior.reduce((s, x) => s + x, 0) / prior.length : dxy;
  const dollarWeak = dxy < dxyAvg;

  // Standard risk-off thresholds: VIX 30 = panic, curve -0.5% = deep inversion (recession warning)
  const riskOn = vix < 30 && curve > -0.5;

  if (ctx.position > 0) {
    const hardStop = ctx.entryPx != null ? ctx.entryPx * 0.8 : null;
    ctx.watch([
      { side: 'sell', price: sma200, trigger: 'below', note: 'SMA200 trend break' },
      { side: 'sell', price: hardStop, trigger: 'below', note: '20% disaster stop' }
    ]);
    if (prevClose < sma200) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    if (hardStop != null && prevClose < hardStop) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    return null;
  }

  ctx.watch([
    { side: 'buy', price: sma200, trigger: 'above', note: 'SMA200 uptrend',
      conds: [
        { label: 'VIX < 30', now: vix, op: '<', ref: 30, closed: true },
        { label: 'curve > -0.5', now: curve, op: '>', ref: -0.5, closed: true },
        { label: 'dollar weak', ok: dollarWeak, closed: true }
      ] }
  ]);

  if (riskOn && dollarWeak && prevClose > sma200) {
    // 60% of cash per entry; 20% stop limits account risk to ~12%
    const qty = (0.6 * ctx.cash) / ctx.price * 0.99;
    return { side: 'buy', qty: qty };
  }
  return null;
}
