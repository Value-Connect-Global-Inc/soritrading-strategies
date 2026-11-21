/*
 * @coinsori-strategy v1
 * name: BTC VIX Risk-Regime 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why: BTC is a risk asset — when equity vol (VIX) spikes, crypto sells off. Using the VIX as an external risk switch should dodge crash weeks while keeping most of the uptrend.
 * When it buys/sells: buys when VIX is calm (<20) and price is above the 200-bar EMA; sells to cash when VIX turns stressed (>25), price closes below the EMA, or a 3x ATR stop is hit.
 * When it does NOT work: the VIX is a lagged daily number (2-day delay) so it cannot catch a same-day crash; in a slow grinding bear with a calm VIX only the trend filter protects it.
 */
function onUpdate(ctx) {
  const vix = ctx.data("base_vix");
  const ema = ctx.ema(200, 1);
  const prevClose = ctx.closes.at(-2);
  const atr = ctx.atr(14, 1);
  if (vix == null || ema == null || prevClose == null || atr == null) return null;

  const pos = ctx.position || 0;
  const riskOn = vix < 20;   // calm equity vol = risk-on for crypto
  const riskOff = vix > 25;  // stressed vol = step aside
  const inUptrend = prevClose > ema;

  let stop = null;
  if (pos > 0 && ctx.entryPx != null) stop = ctx.entryPx - 3 * atr;

  ctx.watch([
    { side: 'buy', price: ema, trigger: 'above', note: 'EMA200 reclaim', conds: [{ label: 'VIX', now: vix, op: '<', ref: 20 }] },
    { side: 'sell', price: ema, trigger: 'below', note: 'EMA200 break' },
    { side: 'sell', price: ctx.price, trigger: 'below', note: 'VIX>25 exit', conds: [{ label: 'VIX', now: vix, op: '>', ref: 25 }] },
    ...(stop != null ? [{ side: 'sell', price: stop, trigger: 'below', note: 'ATR stop' }] : [])
  ]);

  if (pos > 0 && stop != null && ctx.price <= stop) {
    return { side: 'sell', qty: pos, reduceOnly: true };
  }
  if (pos > 0 && riskOff) {
    return { side: 'sell', qty: pos, reduceOnly: true };
  }
  if (pos > 0 && !inUptrend) {
    return { side: 'sell', qty: pos, reduceOnly: true };
  }
  if (pos === 0 && riskOn && inUptrend) {
    const qty = (ctx.cash / ctx.price) * 0.95;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
