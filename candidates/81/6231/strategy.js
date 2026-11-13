/*
 * @coinsori-strategy v1
 * name: BTC Funding Crowd Contrarian 4H
 * ex: binanceusdm
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: perpetual funding rates reveal how crowded each side is — extreme positive
 * funding means too many leveraged longs (a contrarian sell), extreme negative means too many
 * shorts (a contrarian buy). Crowds at extremes tend to revert, so we fade them on the futures
 * market where we can also go short.
 * When it buys and sells: buys when funding is >1.3 std below its own 15-day average while price
 * is below its 20-bar SMA; sells short on the mirror image. Every position is closed by a 2xATR
 * take-profit or a 3xATR stop-loss, so a single wrong call cannot hurt the account much.
 * When it does NOT work: in a strong one-way trend funding stays extreme for weeks — the
 * contrarian side fights the trend and the stop takes repeated small losses.
 */

function onUpdate(ctx) {
  const funding = ctx.funding;
  const pos = ctx.position || 0;
  const entry = ctx.entryPx;
  const atr1 = ctx.atr(14, 1);
  const sma20 = ctx.sma(20, 1);
  const c2 = ctx.closes.at(-2);

  // Rolling funding history (restart-safe). Funding refreshes every ~2 bars of 4h.
  let hist = ctx.state.fundingHist || [];
  if (funding != null) {
    hist.push(funding);
    if (hist.length > 90) hist = hist.slice(-90);
    ctx.state.fundingHist = hist;
  }

  if (atr1 == null || sma20 == null || c2 == null || hist.length < 60) return null;
  // A position that starts without an entry price (deployed mid-position) can't be managed yet.
  if (pos !== 0 && entry == null) return null;

  const mean = hist.reduce((a, b) => a + b, 0) / hist.length;
  let varSum = 0;
  for (const f of hist) varSum += (f - mean) * (f - mean);
  const std = Math.sqrt(varSum / hist.length);
  if (std < 1e-9) return null;
  const z = (funding - mean) / std;

  const entryZ = 1.3;   // contrarian entry: funding 1.3 std away from its own 15-day mean
  const tpMult = 2.0;   // take-profit in ATR multiples
  const stopMult = 3.0; // stop-loss in ATR multiples (hard cap on every position)

  const tp = entry != null ? (pos > 0 ? entry + tpMult * atr1 : entry - tpMult * atr1) : null;
  const stop = entry != null ? (pos > 0 ? entry - stopMult * atr1 : entry + stopMult * atr1) : null;

  ctx.watch([
    { side: 'buy', price: sma20, trigger: 'below', note: 'short crowd + price below SMA20', conds: [{ label: 'funding z', now: z, op: '<', ref: -entryZ, closed: true }] },
    { side: 'sell', price: sma20, trigger: 'above', note: 'long crowd + price above SMA20', conds: [{ label: 'funding z', now: z, op: '>', ref: entryZ, closed: true }] },
    ...(tp != null ? [{ side: pos > 0 ? 'sell' : 'buy', price: tp, trigger: pos > 0 ? 'above' : 'below', note: 'ATR take-profit' }] : []),
    ...(stop != null ? [{ side: pos > 0 ? 'sell' : 'buy', price: stop, trigger: pos > 0 ? 'below' : 'above', note: 'ATR stop-loss' }] : [])
  ]);

  if (pos === 0) {
    if (z < -entryZ && c2 < sma20) return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.5 };
    if (z > entryZ && c2 > sma20) return { side: 'sell', qty: (ctx.cash / ctx.price) * 0.5 };
    return null;
  }

  // Price-based exits on closed bars (identical in backtest, paper and live).
  if (pos > 0) {
    if (c2 >= entry + tpMult * atr1) return { side: 'sell', qty: pos, reduceOnly: true };
    if (c2 <= entry - stopMult * atr1) return { side: 'sell', qty: pos, reduceOnly: true };
  } else {
    if (c2 <= entry - tpMult * atr1) return { side: 'buy', qty: -pos, reduceOnly: true };
    if (c2 >= entry + stopMult * atr1) return { side: 'buy', qty: -pos, reduceOnly: true };
  }
  return null;
}
