/*
 * @coinsori-strategy v1
 * name: Volatility Breakout BTC 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Strong 4h BTC moves usually start with a volatility expansion — ATR and volume push above their averages while price breaks a multi-week high. Entering only on that confirmation avoids the fake breakouts a plain Donchian system pays for.
 * When it buys and sells: Buys when flat AND price is above its 300-bar average AND the last closed bar breaks above the prior 55-bar high AND volume is at/above its 50-bar average. ATR must also be expanding — unless price is more than 10% above the 300-bar average, where the trend itself is the confirmation and only normal ATR is needed. Takes half off the position at +6x entry ATR, then sells the rest when price falls 2.5 ATR below the highest close since entry, never worse than 2.5 ATR below entry.
 * When it does NOT work: In a long sideways range the 55-bar breakout fires on small rips and the trailing stop cuts each one for a small loss. It never catches a bottom — it only buys after the trend turns up. In a deep bear market it stays flat (trend filter), so it misses shorting opportunities.
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
    // Partial take-profit: sell half at +6x entry ATR (~12% on BTC 4h). Wide enough
    // to not cut bull legs short, tight enough to lock in real gains on big moves.
    if (ctx.state.tpDone == null && price >= ctx.entryPx + 6 * entryAtr) {
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
  // Why 1.15x on normal entries: genuine breakouts come on expanding volatility.
  let sum = 0, cnt = 0;
  for (let k = 1; k <= 40; k++) {
    const a = ctx.atr(14, k);
    if (a == null) break;
    sum += a; cnt++;
  }
  if (cnt < 30) return null;
  const avgAtr = sum / cnt;

  // Strong-trend relaxation: when price is >10% above its 300-bar average the trend
  // itself is the confirmation, so a breakout only needs normal ATR (>= average).
  // This is where the old rule missed steady grind-up bulls.
  const strongTrend = price > sma300 * 1.10;
  const atrOk = atr != null && (strongTrend ? atr >= avgAtr : atr >= 1.15 * avgAtr);
  if (!atrOk) return null;

  // Volume confirmation: closed bar volume at/above its 50-bar average.
  const v = ctx.volumes.at(-2);
  const av = ctx.avgVol(50);
  if (v == null || av == null || av <= 0 || v < av) return null;

  // Donchian breakout: last closed bar's high above the 55-bar high before it.
  const lastHi = ctx.high(1, 1);
  const priorHi = ctx.high(55, 2);
  if (lastHi == null || priorHi == null || lastHi <= priorHi) {
    if (priorHi != null) ctx.watch([{ side: 'buy', price: priorHi, trigger: 'above', note: '55-bar breakout', conds: [{ label: 'ATR expand', ok: atrOk }, { label: 'Vol>=avg', ok: v >= av }] }]);
    return null;
  }

  ctx.state.hi = price;
  ctx.state.entryAtr = atr;
  return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.99 };
}
