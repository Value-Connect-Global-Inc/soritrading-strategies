/*
 * @coinsori-strategy v1
 * name: Volatility Breakout BTC 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Strong 4h BTC moves usually start with a volatility expansion — ATR and volume push above their averages while price breaks a multi-week high (or low). Entering only on that confirmation avoids the fake breakouts a plain Donchian system pays for. Both directions: longs above the 300-bar average, shorts below it.
 * When it buys and sells: Long when flat and price is above its 300-bar average AND the last closed bar breaks above the prior 55-bar high AND volume is at/above its 50-bar average. ATR must expand — unless price is more than 10% away from the average, where the trend itself is the confirmation. Short side is the exact mirror below the average. Takes half off at +4x entry ATR (long) / -4x (short), then sells the rest when price falls 2.5 ATR from the extreme since entry, never worse than 2.5 ATR from entry.
 * When it does NOT work: In a long sideways range the 55-bar breakout fires on small rips and the trailing stop cuts each one for a small loss. Shorts in a bear market can be squeezed by violent rallies — the ATR stop caps the damage but win rate is lower. It needs volatility; in dead flat markets it sits out.
 */
function onUpdate(ctx) {
  const price = ctx.closes.at(-2);
  if (price == null) return null;
  const atr = ctx.atr(14, 1);

  // ---- long exit: volatility-adaptive trailing stop with partial profit-taking ----
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

  // ---- short exit: mirror of the long ----
  if (ctx.position < 0) {
    if (atr == null) return null;
    const lo = ctx.state.lo != null ? Math.min(ctx.state.lo, price) : price;
    ctx.state.lo = lo;
    const entryAtr = ctx.state.entryAtr != null ? ctx.state.entryAtr : atr;
    ctx.state.entryAtr = entryAtr;
    // Partial take-profit on the short: cover half at -4x entry ATR.
    if (ctx.state.tpDone == null && price <= ctx.entryPx - 4 * entryAtr) {
      ctx.state.tpDone = true;
      return { side: 'buy', qty: -ctx.position * 0.5 };
    }
    // stop above the lowest low, never worse than a fixed risk from entry
    const stopPx = Math.min(lo + 2.5 * atr, ctx.entryPx + 2.5 * entryAtr);
    if (price >= stopPx) return { side: 'buy', qty: -ctx.position };
    ctx.watch([{ side: 'buy', price: stopPx, trigger: 'above', note: 'ATR trailing stop' }]);
    return null;
  }

  // ---- entry only when flat ----
  // Trend filter (classic turtle rule): longs only above the 300-bar average,
  // shorts only below it (4h x 300 = ~50 days). Breakouts against the trend are traps.
  const sma300 = ctx.sma(300, 1);
  if (sma300 == null) return null;

  // Volatility expansion: current ATR above its own average over the last 40 bars.
  let sum = 0, cnt = 0;
  for (let k = 1; k <= 40; k++) {
    const a = ctx.atr(14, k);
    if (a == null) break;
    sum += a; cnt++;
  }
  if (cnt < 30) return null;
  const avgAtr = sum / cnt;
  if (atr == null) return null;

  // Volume confirmation: closed bar volume at/above its 50-bar average.
  const v = ctx.volumes.at(-2);
  const av = ctx.avgVol(50);
  if (v == null || av == null || av <= 0 || v < av) return null;

  // ---- long side: uptrend + upside Donchian breakout ----
  if (price >= sma300) {
    // Strong-trend relaxation: >10% above the average, trend itself confirms, so a
    // breakout only needs normal ATR (>= average) instead of 1.15x expansion.
    const strongTrend = price > sma300 * 1.10;
    const atrOk = strongTrend ? atr >= avgAtr : atr >= 1.15 * avgAtr;
    if (!atrOk) return null;
    const lastHi = ctx.high(1, 1);
    const priorHi = ctx.high(55, 2);
    if (lastHi == null || priorHi == null || lastHi <= priorHi) {
      if (priorHi != null) ctx.watch([{ side: 'buy', price: priorHi, trigger: 'above', note: '55-bar breakout' }]);
      return null;
    }
    ctx.state.hi = price; ctx.state.lo = null; ctx.state.entryAtr = atr; ctx.state.tpDone = null;
    return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.99 };
  }

  // ---- short side: downtrend + downside Donchian breakout ----
  // Strong-bear relaxation: >10% below the average, the downtrend itself confirms.
  const strongBear = price < sma300 * 0.90;
  const atrOk = strongBear ? atr >= avgAtr : atr >= 1.15 * avgAtr;
  if (!atrOk) return null;
  const lastLo = ctx.low(1, 1);
  const priorLo = ctx.low(55, 2);
  if (lastLo == null || priorLo == null || lastLo >= priorLo) {
    if (priorLo != null) ctx.watch([{ side: 'sell', price: priorLo, trigger: 'below', note: '55-bar breakdown' }]);
    return null;
  }
  ctx.state.hi = null; ctx.state.lo = price; ctx.state.entryAtr = atr; ctx.state.tpDone = null;
  return { side: 'sell', qty: (ctx.cash / ctx.price) * 0.99 };
}
