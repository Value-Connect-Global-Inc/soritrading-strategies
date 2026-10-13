/*
 * @coinsori-strategy v1
 * name: BTC Hash-Ribbon Miner Cycle 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: the hash ribbon is a well-documented on-chain bottom
 *   signal. When the 30-day average of network hashrate crosses above the
 *   60-day average, miners have survived a capitulation and are expanding
 *   again — historically the start of a new up-leg. This bets on that miner
 *   cycle rather than on price patterns.
 * When it buys and sells: buy when the 30d hashrate MA crosses above the 60d
 *   MA (miner recovery). Sell on a 3x ATR chandelier trailing stop below the
 *   highest close since entry, or a 20% floor stop. Position is sized so the
 *   stop risks only 2% of the account.
 * When it does NOT work: the signal fires rarely (a few times per cycle), so
 *   it can sit in cash for a year while price runs without a miner capitulation
 *   first. In a long grinding bear market the ribbon can whipsaw with repeated
 *   small losses.
 */
function onUpdate(ctx) {
  const hrRaw = ctx.data('hashrate');
  const atr = ctx.atr(14, 1);
  if (hrRaw == null || atr == null) return null;
  const hr = Number(hrRaw);   // dataset delivers the value as a string
  if (!isFinite(hr)) return null;

  // onUpdate is called several times per bar; accumulate hashrate once per bar
  // so the 30d/60d windows really mean 30/60 days.
  let hist = ctx.state.hrHist || [];
  if (ctx.state.lastBar !== ctx.i) {
    hist.push(hr);
    if (hist.length > 62) hist = hist.slice(-62);
    ctx.state.hrHist = hist;
    ctx.state.lastBar = ctx.i;
  }
  if (hist.length < 62) return null;

  const sma30 = hist.slice(-30).reduce((a, b) => a + b, 0) / 30;
  const sma60 = hist.slice(-60).reduce((a, b) => a + b, 0) / 60;
  const prev30 = hist.slice(-31, -1).reduce((a, b) => a + b, 0) / 30;
  const prev60 = hist.slice(-61, -1).reduce((a, b) => a + b, 0) / 60;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  if (ctx.position > 0) {
    let hh = ctx.state.hhSinceEntry;
    if (hh == null || prevClose > hh) { hh = prevClose; ctx.state.hhSinceEntry = hh; }
    // 3x ATR lets a normal pullback breathe; 20% floor caps catastrophic miner shocks.
    const trail = hh - 3 * atr;
    const floor = ctx.entryPx != null ? ctx.entryPx * 0.8 : 0;
    const stop = Math.max(trail, floor);
    if (ctx.price <= stop) return { side: 'sell', qty: ctx.position };
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: 'hash-ribbon trailing stop' }]);
    return null;
  }
  ctx.state.hhSinceEntry = null;

  // hash ribbon buy: 30d MA crossing above 60d MA = miners recovering after capitulation.
  if (!(prev30 <= prev60 && sma30 > sma60)) return null;
  const riskCash = ctx.cash * 0.02;
  const stopDist = 3 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.99) / ctx.price;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
