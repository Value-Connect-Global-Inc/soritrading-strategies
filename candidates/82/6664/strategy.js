/*
 * @coinsori-strategy v1
 * name: SOL 1D NDX Risk-On Regime (spot)
 * ex: binance
 * syms: SOL/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: This is a pure GENERALIZATION test of the NASDAQ risk-on
 * gate that validated on BTC 1d (6661) and ETH 1d (6663). SOL is a high-beta
 * alt: when equity risk appetite is strong (NASDAQ above its own mean) it
 * trends up hard; when risk appetite collapses it crashes harder than BTC/ETH.
 * We hold SOL only while the price trend AND the equity risk regime are up.
 * Same code, same parameters as 6663 — nothing tuned to SOL.
 * When it buys and sells: buys when SOL closes above its 50-day EMA AND the
 * NASDAQ z-score is above -0.5 (risk-on). Exits when SOL closes below the
 * 50-day EMA or a capped trailing stop is hit.
 * When it does NOT work: in a crypto-only rally that equities do not confirm
 * (NASDAQ flat while SOL pumps) the gate keeps it out and it underperforms
 * holding; SOL is more volatile so the 20% cap and EMA exit whipsaw more; the
 * 2-day data lag means the risk gate reacts late to a sudden crash.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const ema50_1 = ctx.ema(50, 1);
  const atr1 = ctx.atr(14, 1);
  const ndx = ctx.data('base_ndx');
  if (price == null || ema50_1 == null || atr1 == null || atr1 <= 0 || ndx == null) {
    ctx.watch([]);
    return null;
  }

  // Rolling NASDAQ history for a z-score vs its own 200-day mean. ctx.data
  // gives one value per bar, so we keep our own series in ctx.state.
  const arr = ctx.state.ndxArr || [];
  arr.push(ndx);
  if (arr.length > 200) arr.shift();
  ctx.state.ndxArr = arr;

  let ndxZ = null;
  if (arr.length >= 60) {
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const sd = Math.sqrt(arr.reduce((a, b) => a + (b - mean) * (b - mean), 0) / arr.length);
    if (sd > 1e-9) ndxZ = (ndx - mean) / sd;
  }
  if (ndxZ == null) {
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

  // Flat: enter only when the price trend AND the equity risk regime are up.
  const uptrend = close1 > ema50_1;
  const riskOn = ndxZ > -0.5;
  ctx.watch([{ side: 'buy', price: ema50_1, trigger: 'above', note: 'long risk-on', conds: [{ label: 'NDX z', now: ndxZ, op: '>', ref: -0.5 }, { label: 'close > EMA50', ok: uptrend }] }]);
  if (allocOk && uptrend && riskOn) {
    ctx.state.highSince = close1;
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  return null;
}
