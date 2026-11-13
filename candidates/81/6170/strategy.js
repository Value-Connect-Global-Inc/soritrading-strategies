/*
 * @coinsori-strategy v1
 * name: Macro-Gated BTC 4H Trend
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: BTC trends strongly on the 4h chart, but the 2022-2023 bear years were signposted by an inverted US Treasury yield curve. Gating a selective Donchian breakout (turtle) system with that slow macro risk switch keeps the trend profits while stepping aside in risk-off years.
 * When it buys and sells: buys only when the 10y-2y curve is not inverted (spread > -0.2), price is above its 200-bar SMA, and price breaks above the 55-bar high; sells when price breaks below the 20-bar low, the curve inverts, or a 3xATR hard stop is hit.
 * When it does NOT work: in a sideways/chop regime every breakout fails and the 3xATR stop locks in repeated small losses; the macro gate also misses the early recovery of a new bull that starts while the curve is still slightly inverted.
 */

function onUpdate(ctx) {
  const spread = ctx.data("base_t10y2y");
  if (spread == null) return null;

  // Closed-bar values so backtest/live/paper agree.
  const atr = ctx.atr(14, 1);
  const sma200 = ctx.sma(200, 1);
  const close1 = ctx.closes.at(-2);
  if (atr == null || sma200 == null || close1 == null) return null;

  // Donchian channels: highest high / lowest low of the last 55/20 CLOSED bars.
  // (k starts at 2 so the still-forming current bar is never included.)
  let hh = -Infinity;
  for (let k = 2; k <= 56; k++) { const h = ctx.highs.at(-k); if (h == null) break; if (h > hh) hh = h; }
  let ll = Infinity;
  for (let k = 2; k <= 21; k++) { const l = ctx.lows.at(-k); if (l == null) break; if (l < ll) ll = l; }
  if (!isFinite(hh) || !isFinite(ll)) return null;

  // -0.2: allow longs unless the curve is clearly inverted (not just barely negative).
  const riskOn = spread > -0.2;

  if (ctx.position <= 0) {
    ctx.watch([{
      side: 'buy', price: hh, trigger: 'above', note: '55-bar breakout',
      conds: [{ label: 'curve not inverted', ok: riskOn }, { label: 'price>SMA200', ok: close1 > sma200 }]
    }]);
    // SMA200 filter: only buy breakouts when the longer trend is already up.
    if (riskOn && close1 > sma200 && ctx.price > hh) {
      return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.95 };
    }
    return null;
  }

  const stopPx = ctx.entryPx != null ? ctx.entryPx - 3 * atr : null;
  const watchArr = [{ side: 'sell', price: ll, trigger: 'below', note: '20-bar exit' }];
  if (stopPx != null) watchArr.push({ side: 'sell', price: stopPx, trigger: 'below', note: '3xATR stop' });
  ctx.watch(watchArr);

  if (!riskOn) return { side: 'sell', qty: ctx.position, reduceOnly: true };
  if (ctx.price < ll) return { side: 'sell', qty: ctx.position, reduceOnly: true };
  if (stopPx != null && ctx.price <= stopPx) return { side: 'sell', qty: ctx.position, reduceOnly: true };
  return null;
}
