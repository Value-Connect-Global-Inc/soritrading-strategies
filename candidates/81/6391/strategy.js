/*
 * @coinsori-strategy v1
 * name: BTC 4H Trend Core USD-Strength Risk Filter
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: A 4-hour trend core (fast EMA above slow EMA) captures the bulk
 * of crypto up-trends. The broad US dollar index measured as a z-score against its
 * own recent average tells us when the dollar is unusually strong — a headwind for
 * crypto. When the dollar is far above its own recent mean we cut position size or
 * stand aside, which is meant to make drawdown clearly smaller than simply holding.
 * When it buys and sells: Buy when the 50-bar EMA is above the 200-bar EMA and price
 * is above the 50-bar EMA, sizing down when the dollar is mildly strong and staying
 * flat when it is more than 1.5 standard deviations above its recent mean. It stays
 * in the trade while the trend structure is intact and only sells when price closes
 * below the 50-bar EMA AND the 50-bar EMA has turned below the 200-bar EMA, on a
 * 3x ATR stop, or when the dollar spikes into extreme strength.
 * When it does NOT work: In a low-volatility melt-up the risk filter never triggers
 * and the strategy behaves like plain trend-following. In a slow grinding bear with
 * no dollar spike it exits on the trend break but the loss is still the trend loss.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const pos = ctx.position || 0;
  const ema50 = ctx.ema(50, 1);
  const ema200 = ctx.ema(200, 1);
  const atr = ctx.atr(14, 1);
  const usd = ctx.data("base.usd_broad");
  if (ema50 == null || ema200 == null || atr == null || usd == null) {
    ctx.watch([]);
    return null;
  }
  const prevClose = ctx.closes.at(-2); // last closed bar (matches ago=1)

  // USD z-score from a rolling buffer of recent unique daily observations
  // (USD index is daily with a 10-day lag; keep only new values, not 6 repeats per day).
  let hist = Array.isArray(ctx.state.usdHist) ? ctx.state.usdHist : [];
  const last = hist.length ? hist[hist.length - 1] : null;
  if (!last || Math.abs(last.v - usd) > 1e-9) {
    hist = hist.concat([{ v: usd }]);
    if (hist.length > 40) hist = hist.slice(-40); // ~5 weeks of daily USD
    ctx.state.usdHist = hist;
  }
  const n = hist.length;
  let mean = 0;
  for (const h of hist) mean += h.v;
  mean /= n;
  let sd = 0;
  for (const h of hist) sd += (h.v - mean) * (h.v - mean);
  sd = Math.sqrt(sd / n);
  const usdZ = sd > 0 ? (usd - mean) / sd : 0;

  const bull = ema50 > ema200;          // trend core: fast EMA above slow EMA
  const riskOff = usdZ > 1.5;           // dollar far above its own recent mean: cut all exposure

  if (pos > 0) {
    const entryPx = ctx.entryPx;
    if (entryPx == null) { ctx.watch([]); return null; }
    const stop = entryPx - 3 * atr;     // hard stop: 3x ATR below entry caps single-trade loss
    const trendBroken = prevClose < ema50 && !bull; // exit only when structure truly breaks, not on a dip
    const watch = [
      { side: 'sell', price: stop, trigger: 'below', note: '3xATR stop' },
      { side: 'sell', price: ema50, trigger: 'below', note: 'trend broke',
        conds: [{ label: 'EMA50<EMA200', ok: !bull, closed: true }] },
      { side: 'sell', price: prevClose, trigger: 'below', note: 'risk-off exit',
        conds: [{ label: 'USD z', now: usdZ, op: '>', ref: 1.5, closed: true }] }
    ];
    if (price <= stop || trendBroken || riskOff) {
      ctx.watch(watch);
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    ctx.watch(watch);
    return null;
  }

  const sizeFrac = riskOff ? 0 : (usdZ > 0.8 ? 0.5 : 0.98); // mild USD strength -> half size
  const watch = [{
    side: 'buy', price: ema50, trigger: 'above', note: 'trend buy',
    conds: [
      { label: 'EMA50>EMA200', ok: bull },
      { label: 'USD z', now: usdZ, op: '<=', ref: 1.5, closed: true }
    ]
  }];
  if (bull && !riskOff && prevClose > ema50 && sizeFrac > 0) {
    const qty = (ctx.cash / price) * sizeFrac;
    ctx.watch(watch);
    return { side: 'buy', qty };
  }
  ctx.watch(watch);
  return null;
}
