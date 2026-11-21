/*
 * @coinsori-strategy v1
 * name: BTC Pullback-to-EMA50 Trend 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: BTC 4h trends are long and persistent, and the proven
 * slow EMA50/200 regime core holds up while fast cores whipsaw. It buys the
 * pullback to the 50-EMA inside a confirmed 200-EMA uptrend, and when the
 * trend is so strong that price runs away from the 50-EMA it re-enters
 * instead of waiting in cash, so it participates in sustained bulls.
 * When it buys and sells: buys when price touches the 50-EMA while EMA50 is
 * above EMA200 (uptrend intact), or re-buys while flat if EMA50>EMA200 and
 * price is above both EMA50 and SMA400 (trend strongly intact). Sells when
 * price closes below the 200-EMA (trend broken) or falls 3x ATR below entry
 * (hard stop).
 * When it does NOT work: in a choppy sideways market the 50-EMA is touched
 * repeatedly and the 200-EMA whipsaws, paying fees on small moves; re-entry
 * adds exposure to trend reversals that the pullback-only version avoided.
 */
function onUpdate(ctx) {
  const ema50 = ctx.ema(50, 1);
  const ema200 = ctx.ema(200, 1);
  const sma400 = ctx.sma(400, 1);
  const atr = ctx.atr(14, 1);
  if (ema50 == null || ema200 == null || sma400 == null || atr == null) {
    ctx.watch([]);
    return null;
  }
  const price = ctx.price;
  const prevClose = ctx.closes.at(-2);
  const pos = ctx.position || 0;

  if (pos > 0) {
    const stop = (ctx.entryPx != null ? ctx.entryPx : price) - 3 * atr;
    ctx.watch([
      { side: 'sell', price: ema200, trigger: 'below', note: 'close < EMA200' },
      { side: 'sell', price: stop, trigger: 'below', note: 'ATR hard stop' }
    ]);
    if (prevClose != null && prevClose < ema200) return { side: 'sell', qty: pos, reduceOnly: true };
    if (price <= stop) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }

  // flat: uptrend = EMA50 above EMA200 and last close above EMA200
  const uptrend = ema50 > ema200 && prevClose != null && prevClose > ema200;
  // pullback: current price touches the 50-EMA from above
  const pullback = price <= ema50;
  // trend-intact re-entry: price running above EMA50 and above SMA400
  const strong = ema50 > ema200 && prevClose != null && prevClose > ema50 && prevClose > sma400;

  ctx.watch([
    { side: 'buy', price: ema50, trigger: 'below', note: 'pullback to EMA50', conds: [
      { label: 'EMA50>EMA200', ok: uptrend }
    ]},
    { side: 'buy', price: sma400, trigger: 'above', note: 'trend-intact re-entry', conds: [
      { label: 'EMA50>EMA200', ok: ema50 > ema200 }
    ]}
  ]);
  if (!uptrend && !strong) return null;
  if (!(pullback && uptrend) && !strong) return null;

  // risk 2% of cash per trade, stop 3x ATR away; cap at 99% cash
  const stopDist = 3 * atr;
  const riskCash = ctx.cash * 0.02;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.99) / price;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
