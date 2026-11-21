/*
 * @coinsori-strategy v1
 * name: ETH Trend-Follow EMA50/200 4H with ATR trailing stop
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: ETH trends persist over 4h bars; a slow EMA50/200 crossover catches
 * sustained moves while an ATR-based trailing stop locks in gains and cuts losses fast.
 * When it buys and sells: buys when the fast EMA crosses above the slow EMA (uptrend),
 * sells when price falls below the ATR trailing stop or the fast EMA crosses back down.
 * When it does NOT work: whipsaws in a sideways market generate repeated small losses,
 * and it underperforms holding during a strong uninterrupted bull run because it exits
 * early on pullbacks. Long-only, so it loses money in bear markets.
 */
function onUpdate(ctx) {
  const emaFast = ctx.ema(50, 1);
  const emaSlow = ctx.ema(200, 1);
  const emaFastPrev = ctx.ema(50, 2);
  const emaSlowPrev = ctx.ema(200, 2);
  const atr = ctx.atr(14, 1);
  if (emaFast == null || emaSlow == null || emaFastPrev == null || emaSlowPrev == null || atr == null) return null;

  const price = ctx.price;
  const pos = ctx.position || 0;

  // trailing stop state persisted across restarts
  const state = ctx.state || {};
  let trail = state.trail;

  // entry: fast EMA crosses above slow EMA (uptrend begins)
  if (pos === 0) {
    if (emaFastPrev <= emaSlowPrev && emaFast > emaSlow) {
      const qty = ctx.cash / price * 0.99;
      ctx.watch([{ side: 'sell', price: price - 3 * atr, trigger: 'below', note: 'initial ATR stop' }]);
      return { side: 'buy', qty: qty };
    }
    ctx.watch([{ side: 'buy', price: emaFast, trigger: 'above', note: 'EMA50 cross above EMA200' }]);
    return null;
  }

  // in position: update trailing stop to highest close minus 3*ATR
  const newTrail = Math.max(trail || 0, price - 3 * atr);
  ctx.state = Object.assign({}, state, { trail: newTrail });

  // exit 1: price breaks below trailing stop
  // exit 2: fast EMA crosses back below slow EMA (trend over)
  const crossDown = emaFastPrev >= emaSlowPrev && emaFast < emaSlow;
  if (price <= newTrail || crossDown) {
    ctx.watch([{ side: 'sell', price: newTrail, trigger: 'below', note: 'trailing stop' }]);
    ctx.state = Object.assign({}, state, { trail: 0 });
    return { side: 'sell', qty: pos, reduceOnly: true };
  }

  ctx.watch([{ side: 'sell', price: newTrail, trigger: 'below', note: 'trailing stop' }]);
  return null;
}
