/*
 * @coinsori-strategy v1
 * name: BTC 1D OnChain Addr Regime Gate (spot)
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The regime-gate shell (EMA50 trend + capped trailing stop)
 * validated on BTC/ETH 1d with two sentiment gates (NDX equity, Fear & Greed).
 * This swaps the gate for a THIRD, completely different data axis: the daily
 * number of unique active Bitcoin addresses (on-chain network usage). Thesis:
 * when network usage expands relative to its own recent mean, price tends to
 * trend; when usage collapses, the rally is not confirmed by real activity.
 * When it buys and sells: buys when BTC closes above its 50-day EMA AND the
 * active-address z-score (vs its 90-day mean) is above -0.5. Exits when BTC
 * closes below the 50-day EMA or a capped trailing stop is hit.
 * When it does NOT work: on-chain usage can lead or lag price by weeks and is
 * noisy; in a choppy market the EMA whipsaws; usage can stay high through a
 * price crash (HODLers), so the gate may not exit fast enough.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const ema50_1 = ctx.ema(50, 1);
  const atr1 = ctx.atr(14, 1);
  const addr = ctx.data('addr');
  if (price == null || ema50_1 == null || atr1 == null || atr1 <= 0 || addr == null) {
    ctx.watch([]);
    return null;
  }

  // Rolling active-address history for a z-score vs its own 90-day mean.
  // ctx.data gives one value per bar, so we keep our own series in ctx.state.
  const arr = ctx.state.addrArr || [];
  arr.push(addr);
  if (arr.length > 90) arr.shift();
  ctx.state.addrArr = arr;

  let addrZ = null;
  if (arr.length >= 30) {
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const sd = Math.sqrt(arr.reduce((a, b) => a + (b - mean) * (b - mean), 0) / arr.length);
    if (sd > 1e-9) addrZ = (addr - mean) / sd;
  }
  if (addrZ == null) {
    ctx.watch([]);
    return null;
  }

  const close1 = ctx.closes.at(-2);
  if (close1 == null) {
    ctx.watch([]);
    return null;
  }
  const pos = ctx.position;
  const allocOk = !ctx.alloc || ctx.alloc.status === 'ok';

  if (pos > 0) {
    const highSince = ctx.state.highSince || close1;
    const newHigh = Math.max(highSince, close1);
    ctx.state.highSince = newHigh;
    // Cap the ATR stop at 20% below the high so a vol spike cannot widen it.
    const stop = Math.max(newHigh - 3 * atr1, newHigh * 0.80);
    const trendBroken = close1 < ema50_1;
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: 'trailing stop' },
               { side: 'sell', price: ema50_1, trigger: 'below', note: 'EMA50 break' }]);
    if (close1 < stop || trendBroken) {
      ctx.state.highSince = 0;
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  // Flat: enter only when the price trend AND on-chain usage are up.
  const uptrend = close1 > ema50_1;
  const usageOn = addrZ > -0.5;
  ctx.watch([{ side: 'buy', price: ema50_1, trigger: 'above', note: 'long usage-on', conds: [{ label: 'addr z', now: addrZ, op: '>', ref: -0.5 }, { label: 'close > EMA50', ok: uptrend }] }]);
  if (allocOk && uptrend && usageOn) {
    ctx.state.highSince = close1;
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  return null;
}
