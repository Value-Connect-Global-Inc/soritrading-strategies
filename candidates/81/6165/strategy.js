/*
 * @coinsori-strategy v1
 * name: Macro Risk Filter BTC 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Regime filter with a macro tripwire: we hold BTC while it is above its
 * 300-bar average (long-term uptrend) AND the VIX is not in panic mode
 * (below 30). We step aside when the trend breaks or when the VIX spikes
 * above 30, which typically marks the start of a risk-off crash. Bet: a
 * slow trend filter alone exits crashes too late; the VIX tripwire gets us
 * out early, so we keep most of the up-move with a much smaller drawdown.
 * When it does NOT work: in a slow grinding bear market VIX stays below 30
 * and we rely on the lagging average; and if VIX stays elevated for weeks
 * we can miss a sharp rally that follows the panic.
 */
function onUpdate(ctx) {
  const TREND = 300;   // long-term trend filter (4h x 300 = ~50 days)
  const VIX_OFF = 30;  // VIX above 30 = panic = risk-off (standard fear threshold)
  const STOP = 0.15;   // hard stop: crash backstop while long

  if (ctx.closes.length < TREND + 3) return null;
  const prevClose = ctx.closes.at(-2);
  const smaT = ctx.sma(TREND, 1);
  if (smaT == null) return null;

  const vix = ctx.data("base_vix"); // FRED CBOE VIX (~2 day lag); null = unknown
  const panic = vix != null && vix > VIX_OFF;
  const inTrend = prevClose > smaT;

  const pos = ctx.position;
  const entry = ctx.entryPx;
  const stopLvl = entry != null ? entry * (1 - STOP) : null;

  // hard stop always armed while long
  if (pos > 0 && stopLvl != null && ctx.lows.at(-1) <= stopLvl) {
    ctx.watch([{ side: 'sell', price: stopLvl, trigger: 'below', note: '15% stop' }]);
    return { side: 'sell', qty: pos, reduceOnly: true };
  }

  const wantLong = inTrend && !panic;

  if (pos > 0 && !wantLong) {
    const w = [{ side: 'sell', price: smaT, trigger: 'below', note: 'trend broke' }];
    if (vix != null) w.push({ side: 'sell', price: ctx.price, trigger: 'below', note: 'VIX panic',
      conds: [{ label: 'VIX', now: vix, op: '>', ref: VIX_OFF, closed: true }] });
    ctx.watch(w);
    return { side: 'sell', qty: pos, reduceOnly: true };
  }
  if (pos <= 0 && wantLong) {
    const w = [{ side: 'buy', price: smaT, trigger: 'above', note: 'trend up' }];
    if (vix != null) w[0].conds = [{ label: 'VIX', now: vix, op: '<', ref: VIX_OFF, closed: true }];
    ctx.watch(w);
    return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.99 };
  }
  if (pos > 0) {
    const w = [{ side: 'sell', price: smaT, trigger: 'below', note: 'trend broke' },
               { side: 'sell', price: stopLvl != null ? stopLvl : 0, trigger: 'below', note: '15% stop' }];
    ctx.watch(w);
  } else {
    const w = [{ side: 'buy', price: smaT, trigger: 'above', note: 'trend up' }];
    if (vix != null) w[0].conds = [{ label: 'VIX', now: vix, op: '<', ref: VIX_OFF, closed: true }];
    ctx.watch(w);
  }
  return null;
}
