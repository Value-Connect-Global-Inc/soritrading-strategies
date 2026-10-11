/*
 * @coinsori-strategy v1
 * name: DXY Macro-Gated BTC Breakout 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: BTC is a risk asset that tends to rally when the US dollar is weak (DXY low) and struggle when the dollar is strong. Adding a macro regime gate to the volatility breakout avoids buying breakouts during dollar-strength headwinds.
 * When it buys and sells: Buys when flat AND price is above its 300-bar average AND the last closed bar breaks the prior 55-bar high AND volume is at/above its 50-bar average AND ATR is expanding 1.15x AND the dollar index (DXY) is below 100 (weak-dollar regime). Takes half off at +4x entry ATR, sells the rest when price falls 2.5 ATR below the highest close since entry, never worse than 2.5 ATR below entry.
 * When it does NOT work: A fixed DXY<100 threshold is crude — in a strong-bull phase the dollar can be above 100 while BTC still rallies, so it misses those moves. DXY data is daily, so regime changes arrive with lag.
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

  // Macro regime gate: only buy when the dollar is weak (DXY < 100). Risk-on regime.
  const dxy = ctx.data('dxy');
  if (dxy == null || dxy >= 100) {
    ctx.watch([{ side: 'buy', price: null, note: 'DXY weak', conds: [{ label: 'DXY', now: dxy, op: '<', ref: 100, closed: true }] }]);
    return null;
  }

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

  // Donchian breakout: last closed bar's high above the 55-bar high before it.
  const lastHi = ctx.high(1, 1);
  const priorHi = ctx.high(55, 2);
  if (lastHi == null || priorHi == null || lastHi <= priorHi) {
    if (priorHi != null) ctx.watch([{ side: 'buy', price: priorHi, trigger: 'above', note: '55-bar breakout', conds: [{ label: 'ATR expand', ok: atr >= 1.15 * avgAtr }, { label: 'Vol>=avg', ok: v >= av }, { label: 'DXY<100', ok: dxy < 100 }] }]);
    return null;
  }

  ctx.state.hi = price;
  ctx.state.entryAtr = atr;
  ctx.state.tpDone = null;  // reset partial-profit flag for the new trade
  return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.99 };
}
