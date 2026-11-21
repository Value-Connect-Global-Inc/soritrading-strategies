/*
 * @coinsori-strategy v1
 * name: BTC Donchian Trend + VIX Crisis Gate 4h
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Trend-following on BTC 4h with a macro crisis gate. The
 * VIX (daily, 2d lag) only steps in during genuine risk-off spikes (VIX > 35),
 * when breakout signals are unreliable; in normal conditions it lets the trend
 * trade freely.
 * When it buys and sells: buys when the current price breaks above the 55-bar
 * Donchian high of closed bars while VIX is not in crisis; sells on a Donchian
 * breakdown or a 2.5-ATR trailing stop.
 * When it does NOT work: in a choppy sideways market the breakout whipsaws, and
 * the VIX gate cannot anticipate a sudden single-day shock (2-day data lag).
 */
function onUpdate(ctx) {
  // Crisis gate: only block entries during a genuine VIX spike.
  const vix = ctx.data('base_vix');
  let crisis = false;
  if (vix != null) {
    crisis = vix > 35;
  }

  // Channel of CLOSED bars (ago=1), so the breakout compares the forming bar
  // against a fully closed 55-bar window. No look-ahead.
  const dc = ctx.donchian(55, 1);
  if (dc == null) {
    ctx.watch([]);
    return null;
  }

  const price = ctx.price;
  const inPosition = ctx.position > 0;

  if (inPosition) {
    const atr = ctx.atr(14, 1);
    if (atr == null) {
      ctx.watch([]);
      return null;
    }
    // Trailing stop: 2.5 ATR below the last close.
    const stop = price - 2.5 * atr;
    ctx.watch([
      { side: 'sell', price: dc.lower, trigger: 'below', note: 'Donchian breakdown' },
      { side: 'sell', price: stop, trigger: 'below', note: 'trailing stop 2.5 ATR' }
    ]);
    if (price <= dc.lower || price <= stop) {
      return { side: 'sell', qty: ctx.position, reduceOnly: true };
    }
    return null;
  }

  ctx.watch([{
    side: 'buy',
    price: dc.upper,
    trigger: 'above',
    note: 'Donchian 55 breakout',
    conds: [{ label: 'not VIX crisis', ok: !crisis }]
  }]);

  if (!crisis && price > dc.upper) {
    const qty = (ctx.cash / ctx.price) * 0.95;
    return { side: 'buy', qty: qty };
  }

  return null;
}
