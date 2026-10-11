/*
 * @coinsori-strategy v1
 * name: Hashrate-Gated BTC Breakout 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: BTC price breakouts are more trustworthy when the network is genuinely growing — hashrate (computing power securing the network) above its 30-day average signals a healthy, expanding network. Adding this fundamental regime gate to the volatility breakout filters out breakouts that happen on a shrinking network.
 * When it buys and sells: Buys when flat AND price is above its 300-bar average AND the last closed bar breaks the prior 55-bar high AND volume is at/above its 50-bar average AND ATR is expanding 1.15x AND hashrate is above its 30-day average. Takes half off at +4x entry ATR, sells the rest when price falls 2.5 ATR below the highest close since entry, never worse than 2.5 ATR below entry.
 * When it does NOT work: Hashrate data is daily and lags price — a price breakout can fire days before hashrate data confirms, so it misses fast moves. In a bear market hashrate falls, keeping it out (which is intended). It never catches a bottom.
 */
function onUpdate(ctx) {
  const price = ctx.closes.at(-2);
  if (price == null) return null;
  const atr = ctx.atr(14, 1);

  // ---- exit: volatility-adaptive trailing stop with partial profit-taking ----
  if (ctx.position > 0) {
    if (atr == null) return null;
    const hi = ctx.state.hi != null ? Math.max(ctx.state.hi, price) : price;
    ctx.state.hi = hi;
    const entryAtr = ctx.state.entryAtr != null ? ctx.state.entryAtr : atr;
    ctx.state.entryAtr = entryAtr;
    // Partial take-profit: sell half at +4x entry ATR (~8% on BTC 4h). Locks in real
    // gains while the other half keeps riding the trailing stop for the bigger move.
    if (ctx.state.tpDone == null && price >= ctx.entryPx + 4 * entryAtr) {
      ctx.state.tpDone = true;
      return { side: 'sell', qty: ctx.position * 0.5 };
    }
    // trailing stop widens with volatility but never below a fixed risk from entry
    const stopPx = Math.max(hi - 2.5 * atr, ctx.entryPx - 2.5 * entryAtr);
    if (price <= stopPx) return { side: 'sell', qty: ctx.position };
    ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: 'ATR trailing stop' }]);
    return null;
  }

  // ---- entry only when flat ----
  // Trend filter (classic turtle rule): only take longs above the 300-bar average
  // (4h x 300 = ~50 days). Breakouts in a downtrend are rebound traps.
  const sma300 = ctx.sma(300, 1);
  if (sma300 == null || price < sma300) return null;

  // Volatility expansion: current ATR above its own average over the last 40 bars.
  // Why 1.15x: genuine breakouts come on expanding volatility.
  let sum = 0, cnt = 0;
  for (let k = 1; k <= 40; k++) {
    const a = ctx.atr(14, k);
    if (a == null) break;
    sum += a; cnt++;
  }
  if (cnt < 30) return null;
  const avgAtr = sum / cnt;
  if (atr == null || atr < 1.15 * avgAtr) return null;

  // Volume confirmation: closed bar volume at/above its 50-bar average.
  const v = ctx.volumes.at(-2);
  const av = ctx.avgVol(50);
  if (v == null || av == null || av <= 0 || v < av) return null;

  // Hashrate regime gate: only buy when the network is growing (hashrate above its
  // 30-day average). Fundamental confirmation that the breakout is real.
  const h = ctx.data('hashrate');
  const hSm = ctx.data('hashrate_sma30');
  if (h == null || hSm == null || hSm <= 0 || h < hSm) {
    ctx.watch([{ side: 'buy', price: ctx.high(55, 2), trigger: 'above', note: '55-bar breakout', conds: [{ label: 'ATR expand', ok: atr >= 1.15 * avgAtr }, { label: 'Vol>=avg', ok: v >= av }, { label: 'HR>30d avg', ok: h > hSm }] }]);
    return null;
  }

  // Donchian breakout: last closed bar's high above the 55-bar high before it.
  const lastHi = ctx.high(1, 1);
  const priorHi = ctx.high(55, 2);
  if (lastHi == null || priorHi == null || lastHi <= priorHi) {
    if (priorHi != null) ctx.watch([{ side: 'buy', price: priorHi, trigger: 'above', note: '55-bar breakout', conds: [{ label: 'ATR expand', ok: atr >= 1.15 * avgAtr }, { label: 'Vol>=avg', ok: v >= av }, { label: 'HR>30d avg', ok: h > hSm }] }]);
    return null;
  }

  ctx.state.hi = price;
  ctx.state.entryAtr = atr;
  ctx.state.tpDone = null;  // reset partial-profit flag for the new trade
  return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.99 };
}
