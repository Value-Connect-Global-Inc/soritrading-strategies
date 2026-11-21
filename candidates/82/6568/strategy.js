/*
 * @coinsori-strategy v1
 * name: ETH VIX Regime Long-Short 4H
 * ex: binanceusdm
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: ETH's biggest moves are regime-driven: calm VIX lets long up-trends run, panic
 * VIX triggers risk-off crashes. The verified long-only version rode the calm up-trends but sat in
 * cash during bear markets. This adds the other half: in a confirmed panic (VIX high) it SHORTS the
 * falling market, so it profits from both directions instead of missing the downside.
 * When it buys and sells: Long the whole account when the last closed 4h close is above a RISING
 * 200-bar SMA and VIX is calm (below 25). Flip to SHORT the whole account when the close is below a
 * FALLING 200-bar SMA and VIX is panicking (above 30 for two consecutive days). Otherwise stay flat.
 * A 3x ATR stop closes any position that moves too far against entry.
 * When it does NOT work: In a long flat range the price crosses the SMA repeatedly and each flip
 * costs fees plus funding. VIX is daily and lags 2 days, so a crypto-only crash that has not moved
 * VIX yet is not caught early. Shorting a leveraged perp in a violent short-squeeze can lose fast
 * even with the stop. Funding on a perp is paid while holding, which erodes flat-market returns.
 */
function onUpdate(ctx) {
  const sma = ctx.sma(200, 1);
  if (sma == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const vix = ctx.data('base.vix');
  const vixCalm = vix == null ? true : vix < 25;
  const st = ctx.state;
  const vixPanic = vix != null && vix > 30;
  const panicStreak = vixPanic ? (st.panicStreak || 0) + 1 : 0;
  st.panicStreak = panicStreak;
  const riskOff = panicStreak >= 2;

  const band = 0.02; // 2% hysteresis so small noise around the SMA does not churn the position
  const pos = ctx.position || 0;

  // volatility hard stop: 3x the 14-bar ATR from entry (works for both long and short)
  if (pos !== 0 && ctx.entryPx != null) {
    const atr = ctx.atr(14, 1);
    if (atr != null) {
      const stop = pos > 0 ? ctx.entryPx - 3 * atr : ctx.entryPx + 3 * atr;
      const hit = pos > 0 ? prevClose < stop : prevClose > stop;
      if (hit) {
        ctx.watch([{ side: pos > 0 ? 'sell' : 'buy', price: stop, trigger: pos > 0 ? 'below' : 'above', note: 'ATR hard stop' }]);
        return { side: pos > 0 ? 'sell' : 'buy', qty: Math.abs(pos), reduceOnly: true };
      }
    }
  }

  const smaPrev = ctx.sma(200, 5);
  if (smaPrev == null) return null;
  const rising = sma > smaPrev;
  const falling = sma < smaPrev;

  // exit conditions when holding a position
  if (pos > 0) {
    ctx.watch([
      { side: 'sell', price: sma * (1 - band), trigger: 'below', note: 'SMA200 -2% exit long' },
      { side: 'sell', price: prevClose, trigger: 'below', note: 'VIX panic exit', conds: [{ label: 'VIX panic 2d', ok: riskOff }] }
    ]);
    if (prevClose < sma * (1 - band) || riskOff) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }
  if (pos < 0) {
    ctx.watch([
      { side: 'buy', price: sma * (1 + band), trigger: 'above', note: 'SMA200 +2% exit short' },
      { side: 'buy', price: prevClose, trigger: 'above', note: 'VIX calm exit', conds: [{ label: 'VIX calm', ok: vixCalm }] }
    ]);
    if (prevClose > sma * (1 + band) || vixCalm) {
      return { side: 'buy', qty: -pos, reduceOnly: true };
    }
    return null;
  }

  // entries when flat
  if (rising && vixCalm && prevClose > sma * (1 + band)) {
    ctx.watch([{ side: 'buy', price: sma * (1 + band), trigger: 'above', note: 'SMA200 +2% go long', conds: [{ label: 'VIX calm', ok: vixCalm }] }]);
    return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.99 };
  }
  if (falling && riskOff && prevClose < sma * (1 - band)) {
    ctx.watch([{ side: 'sell', price: sma * (1 - band), trigger: 'below', note: 'SMA200 -2% go short', conds: [{ label: 'VIX panic 2d', ok: riskOff }] }]);
    return { side: 'sell', qty: (ctx.cash / ctx.price) * 0.99 };
  }
  ctx.watch([]);
  return null;
}
