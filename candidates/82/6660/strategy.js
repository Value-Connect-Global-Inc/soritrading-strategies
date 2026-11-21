/*
 * @coinsori-strategy v1
 * name: SOL 4H Funding-Contrarian Trend (usdm)
 * ex: binanceusdm
 * syms: SOL/USDT
 * interval: 4h
 * cash: 1000
 *
 * Why this strategy: Perpetual funding is a direct price on how crowded the
 * leveraged crowd is. When shorts pay heavily (funding far below its own
 * recent mean) a bounce is likely; we buy those dips only while the 100-bar
 * EMA says the trend is still up, so we never catch a falling knife in a bear.
 * When it buys and sells: buys when the close is above the 100-bar EMA AND the
 * funding z-score is unusually low (crowded shorts). Exits when the close
 * falls below the EMA (trend broke) or when a trailing stop is hit, capped at
 * 20% below the highest close since entry so a vol spike cannot widen it into
 * a bleed during a crash. Position is half notional so one bad drawdown cannot
 * ruin the account.
 * When it does NOT work: in a flat sideways market the EMA filter keeps it in
 * cash most of the time, so it misses range bounces; in a relentless one-way
 * bull it still trails a pure buy-and-hold; the 8-hourly funding payment is a
 * small drag on any held position.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const ema100_1 = ctx.ema(100, 1);
  const atr1 = ctx.atr(14, 1);
  const f = ctx.funding;
  if (price == null || ema100_1 == null || atr1 == null || atr1 <= 0 || f == null) {
    ctx.watch([]);
    return null;
  }

  // Rolling funding history: 120 4h-bars = 20 days of 8h funding cycles.
  const arr = ctx.state.fundArr || [];
  arr.push(f);
  if (arr.length > 120) arr.shift();
  ctx.state.fundArr = arr;

  let z = null;
  if (arr.length >= 60) {
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const sd = Math.sqrt(arr.reduce((a, b) => a + (b - mean) * (b - mean), 0) / arr.length);
    if (sd > 1e-9) z = (f - mean) / sd;
  }
  if (z == null) {
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
  // Half notional: keeps the edge but caps the damage of any single drawdown.
  const size = (ctx.cash / price) * 0.5 * 0.99;

  if (pos > 0) {
    const highSince = ctx.state.highSince || close1;
    const newHigh = Math.max(highSince, close1);
    ctx.state.highSince = newHigh;
    // Cap the ATR stop at 20% below the high: a raw 2.5*ATR stop widens during
    // crashes (ATR spikes), turning into a guaranteed bleed instead of a stop.
    const stop = Math.max(newHigh - 2.5 * atr1, newHigh * 0.80);
    const trendBroken = close1 < ema100_1;
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: 'trailing stop' },
               { side: 'sell', price: ema100_1, trigger: 'below', note: 'EMA100 break' }]);
    if (close1 < stop || trendBroken) {
      ctx.state.highSince = 0;
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  // Flat: buy a crowded-short dip only in an uptrend.
  const uptrend = close1 > ema100_1;
  const crowdedShort = z < -0.6;
  ctx.watch([{ side: 'buy', price: ema100_1, trigger: 'above', note: 'long in uptrend', conds: [{ label: 'funding z', now: z, op: '<', ref: -0.6 }, { label: 'close > EMA100', ok: uptrend }] }]);
  if (allocOk && uptrend && crowdedShort) {
    ctx.state.highSince = close1;
    return { side: 'buy', qty: size };
  }
  return null;
}
