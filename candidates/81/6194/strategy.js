/*
 * @coinsori-strategy v1
 * name: BTC 4H VIX-Regime Trend Gate
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: The VIX is a daily macro fear gauge. When it is calm (< 22) risk assets
 * tend to drift up, and when it spikes (>= 25) crypto usually corrects. Gating a normal EMA
 * trend with this macro signal lets the strategy ride calm bull legs and step aside before
 * the worst of a crash — a cross-asset risk filter that price-only trend filters catch late.
 * When it buys and sells: Buy when the 50-EMA is above the 200-EMA, price closes above the
 * 50-EMA and VIX is below 22 (calm uptrend). Sell everything when VIX reaches 25 (risk-off),
 * when the 50-EMA crosses below the 200-EMA, or on a -25% disaster stop.
 * When it does NOT work: In a strong melt-up where VIX stays elevated (e.g. 2020-21) the gate
 * keeps it out and it misses most of the rise; VIX is daily data with a 2-day lag, so a
 * sudden crash can still be entered before the spike is known.
 */
function onUpdate(ctx) {
  const ema50 = ctx.ema(50, 1);
  const ema200 = ctx.ema(200, 1);
  const vix = ctx.data("base.vix");
  const prevClose = ctx.closes.at(-2);
  if (ema50 == null || ema200 == null || vix == null || prevClose == null) {
    ctx.watch([]);
    return null;
  }
  const uptrend = ema50 > ema200;
  const calm = vix < 22;
  const riskOff = vix >= 25;

  if (ctx.position > 0) {
    const disaster = ctx.entryPx != null ? ctx.entryPx * 0.75 : null;
    ctx.watch([
      { side: 'sell', price: ema50, trigger: 'below', note: 'trend death EMA50<EMA200', conds: [{ label: 'EMA50<EMA200', ok: ema50 < ema200 }] },
      { side: 'sell', price: prevClose, trigger: 'below', note: 'VIX risk-off >=25', conds: [{ label: 'VIX>=25', now: vix, op: '>=', ref: 25, closed: true }] },
      ...(disaster != null ? [{ side: 'sell', price: disaster, trigger: 'below', note: 'disaster -25%' }] : [])
    ]);
    if (disaster != null && prevClose < disaster) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    if (ema50 < ema200) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    if (riskOff) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    return null;
  }

  if (ctx.alloc != null && ctx.alloc.status !== 'ok') {
    ctx.watch([]);
    return null;
  }
  if (uptrend && calm && prevClose > ema50) {
    ctx.watch([{ side: 'buy', price: ema50, trigger: 'above', note: 'calm uptrend', conds: [{ label: 'EMA50>EMA200', ok: true }, { label: 'VIX<22', now: vix, op: '<', ref: 22, closed: true }] }]);
    const qty = (ctx.cash / prevClose) * 0.99;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  ctx.watch([{ side: 'buy', price: ema50, trigger: 'above', note: 'waiting calm uptrend', conds: [{ label: 'EMA50>EMA200', ok: uptrend }, { label: 'VIX<22', now: vix, op: '<', ref: 22, closed: true }] }]);
  return null;
}
