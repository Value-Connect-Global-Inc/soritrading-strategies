/*
 * @coinsori-strategy v1
 * name: BTC EMA Pullback MR ScaleOut 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Improvement of 5760 (validated winner). In an uptrend, pullbacks to a rising short-term average are temporary — price reverts to the mean. Change: scale out half at the EMA20 reversion (lock the mean-reversion gain) and let the other half ride with a wider trailing stop so winners can run further.
 * When it buys and sells: Buy when price <= EMA20 with RSI(14)<35 and 200-bar average rising (bull gate). Sell half when price reverts above EMA20; trail the rest with a stop at 4xATR below the highest close since entry, or 15% hard stop.
 * When it does NOT work: In a bear market the trend gate stays flat (good); a strong bull that never dips under EMA20 is missed; sharp V-reversals can hit the stop before reversion plays out.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const pos = ctx.position;
  const ema20 = ctx.ema(20, 1);
  const rsi = ctx.rsi(14, 1);
  const sma200 = ctx.sma(200, 1);
  const sma200prev = ctx.sma(200, 2);
  const atr = ctx.atr(14, 1);
  if (ema20 == null || rsi == null || sma200 == null || sma200prev == null || atr == null) return null;

  if (pos > 0) {
    const entryPx = ctx.entryPx;
    // track highest close since entry for the trailing portion
    const state = ctx.state;
    const hi = (state.hi != null && state.hi > price) ? state.hi : price;
    ctx.state = { ...state, hi: hi };
    const trail = (atr != null) ? hi - 4 * atr : null; // 4xATR trailing stop below highest close
    const hard = (entryPx != null) ? entryPx * 0.85 : null; // 15% hard stop on the whole position
    ctx.watch([
      { side: 'sell', price: ema20, trigger: 'above', note: 'revert to EMA20 (sell half)' },
      { side: 'sell', price: trail, trigger: 'below', note: '4xATR trail' },
      { side: 'sell', price: hard, trigger: 'below', note: '15% hard stop' }
    ]);
    // hard stop always exits everything
    if (hard != null && price < hard) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    // trailing stop exits everything too
    if (trail != null && price < trail) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    // mean reversion: sell half at EMA20, keep the rest for the trail
    if (price > ema20) {
      const half = pos * 0.5;
      return { side: 'sell', qty: half, reduceOnly: true };
    }
    return null;
  }

  const trendUp = sma200 > sma200prev;
  ctx.watch([
    { side: 'buy', price: ema20, trigger: 'below', note: 'pullback to EMA20', conds: [
      { label: 'RSI(14)', now: rsi, op: '<', ref: 35, closed: true },
      { label: 'SMA200 rising', ok: trendUp }
    ]}
  ]);
  if (price <= ema20 && rsi < 35 && trendUp) {
    ctx.state = {}; // reset trail tracker on new entry
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.95 };
  }

  return null;
}
