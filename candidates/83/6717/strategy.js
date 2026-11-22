/*
 * @coinsori-strategy v1
 * name: BTC Fast-Exit Trend Spot 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Bitcoin's biggest gains come in long up-trends, but a slow average like the
 * 200-day MA gives back too much at the top and whipsaws in volatile bull markets. This version
 * stays long through the whole rise using a trailing stop that follows the price, so it keeps
 * more of the bull move and exits only when the trend actually turns.
 * When it buys and sells: buys when price is above the 200-period average and short-term momentum
 * turns up; sells when price falls 3x the average range from the highest point since entry, or
 * when price falls back below the 200-period average.
 * When it does NOT work: in choppy sideways markets the momentum entries whipsaw and small
 * stop-losses add up; a sudden violent crash can hit the trailing stop before the trend filter
 * reacts. It is long-only, so it cannot profit from falling markets.
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
  const prevClose = ctx.closes.at(-2);
  if (ema200 == null || ema50 == null || ema20 == null || ema20p == null || atr == null || prevClose == null) {
    ctx.watch([]);
    return null;
  }

  // regime from CLOSED bars so backtest/paper/live behave identically
  const bull = prevClose > ema200;                    // uptrend regime: only take longs in it
  const crossUp = ema20p <= ema50 && ema20 > ema50;   // momentum turned up on closed bars

  const MULT = 3.0; // 3x ATR trailing stop: wide enough to survive noise, tight enough to cut reversals

  const allocOk = !ctx.alloc || ctx.alloc.status === 'ok'; // reduce-only mode: no new entries

  if (pos === 0) {
    ctx.watch([
      { side: 'buy', price: ema200, trigger: 'above', note: 'long: uptrend + momo up', conds: [{ label: 'EMA20>EMA50', ok: crossUp }] }
    ]);
    if (!allocOk) return null;
    if (bull && crossUp) {
      ctx.state.extreme = prevClose;
      return { side: 'buy', qty: cash / px * 0.99 };
    }
    return null;
  }

  // In a position: trail the anchor at the best price seen (closed bars only, no look-ahead)
  let extreme = ctx.state.extreme != null ? ctx.state.extreme : prevClose;
  const hi = ctx.highs.at(-2);
  extreme = Math.max(extreme, hi);
  ctx.state.extreme = extreme;

  const trail = extreme - MULT * atr;
  const hitTrail = ctx.lows.at(-2) < trail; // stop was touched inside the closed bar
  const regimeFlip = prevClose < ema200;

  ctx.watch([
    { side: 'sell', price: trail, trigger: 'below', note: 'trailing stop' },
    { side: 'sell', price: ema200, trigger: 'below', note: 'trend flip exit' }
  ]);

  if (hitTrail || regimeFlip) {
    ctx.state.extreme = null;
    return { side: 'sell', qty: Math.abs(pos), reduceOnly: true };
  }
  return null;
}
