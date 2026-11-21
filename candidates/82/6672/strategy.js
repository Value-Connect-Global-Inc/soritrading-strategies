/*
 * @coinsori-strategy v1
 * name: BTC 1D VIX Spike-Exit Trend (spot)
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The earlier VIX ENTRY-gate form was too restrictive — it
 * required a calm VIX to buy, so it sat out parabolic bull runs. This is a
 * different shape: VIX is used only as a RISK-OFF EXIT filter. Thesis: a VIX
 * spike marks a flight to safety that usually drags BTC down, so exiting on a
 * spike cuts drawdown, while entries stay on plain trend so upside is kept.
 * When it buys and sells: buys when BTC closes above its 50-day EMA. Exits when
 * BTC closes below the 50-day EMA, a capped trailing stop is hit, or the VIX
 * z-score (vs its 90-day mean) spikes above +1.5.
 * When it does NOT work: VIX can spike and revert without BTC falling (false
 * exits cost fees and re-entry at higher prices); VIX data has a 2-day lag; in
 * a choppy market the EMA whipsaws.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const ema50_1 = ctx.ema(50, 1);
  const atr1 = ctx.atr(14, 1);
  const vix = ctx.data('base_vix');
  if (price == null || ema50_1 == null || atr1 == null || atr1 <= 0 || vix == null) {
    ctx.watch([]);
    return null;
  }

  // VIX z-score vs its own 90-day mean (rolling history kept in ctx.state).
  const arr = ctx.state.vixArr || [];
  arr.push(vix);
  if (arr.length > 90) arr.shift();
  ctx.state.vixArr = arr;

  let vixZ = null;
  if (arr.length >= 30) {
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const sd = Math.sqrt(arr.reduce((a, b) => a + (b - mean) * (b - mean), 0) / arr.length);
    if (sd > 1e-9) vixZ = (vix - mean) / sd;
  }
  if (vixZ == null) { ctx.watch([]); return null; }

  const close1 = ctx.closes.at(-2);
  if (close1 == null) { ctx.watch([]); return null; }
  const pos = ctx.position;
  const allocOk = !ctx.alloc || ctx.alloc.status === 'ok';

  if (pos > 0) {
    const highSince = ctx.state.highSince || close1;
    const newHigh = Math.max(highSince, close1);
    ctx.state.highSince = newHigh;
    // Cap the ATR stop at 20% below the high so a vol spike cannot widen it.
    const stop = Math.max(newHigh - 3 * atr1, newHigh * 0.80);
    const trendBroken = close1 < ema50_1;
    const riskOff = vixZ > 1.5;
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: 'trailing stop' },
               { side: 'sell', price: ema50_1, trigger: 'below', note: 'EMA50 break' },
               { side: 'sell', price: price, trigger: 'above', note: 'VIX spike', conds: [{ label: 'vix z', now: vixZ, op: '>', ref: 1.5 }] }]);
    if (close1 < stop || trendBroken || riskOff) {
      ctx.state.highSince = 0;
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  // Flat: enter on trend alone — VIX only gates the exit, not the entry.
  const uptrend = close1 > ema50_1;
  ctx.watch([{ side: 'buy', price: ema50_1, trigger: 'above', note: 'long trend' }]);
  if (allocOk && uptrend) {
    ctx.state.highSince = close1;
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  return null;
}
