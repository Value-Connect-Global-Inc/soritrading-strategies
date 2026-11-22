/*
 * @coinsori-strategy v1
 * name: BTC Dual-Direction Trend Perp 4H
 * ex: binanceusdm
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Bitcoin moves in long trends, up and down. Trading a perpetual contract lets the strategy profit in BOTH directions, which buy-and-hold cannot do — it makes money in falling markets too.
 * When it buys and sells: In an uptrend (price above the 200-period average) it buys when short momentum turns up; in a downtrend (price below it) it shorts when momentum turns down. It rides the trend with a 3x-ATR trailing stop and exits when the trend flips.
 * When it does NOT work: in choppy sideways markets the momentum entries whipsaw and small stop-losses add up; a sudden violent reversal can hit the trailing stop before the trend filter reacts.
 */
function onUpdate(ctx) {
  const px = ctx.price;
  const cash = ctx.cash;
  const pos = ctx.position;

  const ema200 = ctx.ema(200, 1);
  const ema50 = ctx.ema(50, 1);
  const ema20 = ctx.ema(20, 1);
  const ema20p = ctx.ema(20, 2);
  const atr = ctx.atr(14, 1);
  if (ema200 == null || ema50 == null || ema20 == null || ema20p == null || atr == null) {
    ctx.watch([]);
    return null;
  }

  const bull = px > ema200;   // uptrend regime: longs only
  const bear = px < ema200;   // downtrend regime: shorts only
  const crossUp = ema20p <= ema50 && ema20 > ema50;
  const crossDn = ema20p >= ema50 && ema20 < ema50;

  const RISK = 0.015; // risk 1.5% of equity per trade if the stop is hit — a run of 30 losses still cannot ruin the account
  const MULT = 3.0;   // 3x ATR trailing stop: wide enough to survive normal noise, tight enough to cut reversals

  if (pos === 0) {
    ctx.watch([
      { side: 'buy', price: ema200, trigger: 'above', note: 'long: uptrend + momo up', conds: [{ label: 'EMA20>EMA50', ok: crossUp }] },
      { side: 'sell', price: ema200, trigger: 'below', note: 'short: downtrend + momo down', conds: [{ label: 'EMA20<EMA50', ok: crossDn }] }
    ]);
    if (bull && crossUp) {
      const qty = (RISK * cash) / (MULT * atr);
      ctx.state.extreme = px;
      return { side: 'buy', qty };
    }
    if (bear && crossDn) {
      const qty = (RISK * cash) / (MULT * atr);
      ctx.state.extreme = px;
      return { side: 'sell', qty };
    }
    return null;
  }

  // In a position: trail the anchor at the best price seen (closed bars only, no look-ahead)
  const long = pos > 0;
  let extreme = ctx.state.extreme != null ? ctx.state.extreme : px;
  const hi = ctx.highs.at(-2);
  const lo = ctx.lows.at(-2);
  extreme = long ? Math.max(extreme, hi) : Math.min(extreme, lo);
  ctx.state.extreme = extreme;

  const trail = long ? extreme - MULT * atr : extreme + MULT * atr;
  const hitTrail = long ? lo < trail : hi > trail; // stop was touched inside the closed bar
  const regimeFlip = long ? px < ema200 : px > ema200;

  ctx.watch(long
    ? [{ side: 'sell', price: trail, trigger: 'below', note: 'trailing stop' },
       { side: 'sell', price: ema200, trigger: 'below', note: 'trend flip exit' }]
    : [{ side: 'buy', price: trail, trigger: 'above', note: 'trailing stop' },
       { side: 'buy', price: ema200, trigger: 'above', note: 'trend flip exit' }]);

  if (hitTrail || regimeFlip) {
    ctx.state.extreme = null;
    return { side: long ? 'sell' : 'buy', qty: Math.abs(pos), reduceOnly: true };
  }
  return null;
}
