/*
 * @coinsori-strategy v1
 * name: BTC VIX Regime Short 4H
 * ex: binanceusdm
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Crypto volatility often moves with equity fear. When the
 * VIX (CBOE Volatility Index) is far above its own average, markets are in a
 * risk-off panic and Bitcoin tends to fall; when VIX is calm, risk appetite
 * returns. Trading BOTH directions (long in calm, short in panic) gives a
 * return source that simple buy-and-hold cannot deliver.
 * When it buys and sells: We compare the VIX to its own recent average
 * (z-score). When VIX is unusually high (panic) we SHORT Bitcoin. When VIX is
 * unusually low (calm) we go LONG. When VIX is near its average we stay flat.
 * When it does NOT work: In a strong bull market where BTC rises regardless
 * of equity fear, the panic-short leg loses and the calm-long leg may miss
 * sharp rallies that start while VIX is still mid-range. VIX is daily data
 * with a 2-day lag, so it cannot react to intraday crypto-specific moves.
 */
function onUpdate(ctx) {
  ctx.state = ctx.state || {};
  if (!ctx.state.warm) { ctx.state.warm = true; ctx.watch([]); return null; }

  const pos = ctx.position || 0;
  const entry = ctx.entryPx;
  const price = ctx.price;
  if (price == null) { ctx.watch([]); return null; }

  const vix = ctx.data("base.vix");
  if (vix == null) { ctx.watch([]); return null; }

  // z-score of VIX vs its own recent mean — SHAPE is relative, not a fixed level.
  const z = ctx.zscore(120, 1);
  if (z == null) { ctx.watch([]); return null; }

  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0) { ctx.watch([]); return null; }

  // restart-surviving close of an existing position
  if (pos !== 0 && entry == null) {
    const side = pos > 0 ? 'sell' : 'buy';
    const flag = 'restartClose_' + side;
    ctx.watch([{ side: side, price: price, trigger: pos > 0 ? 'below' : 'above', note: 'restart close' }]);
    if (ctx.state[flag]) return null;
    ctx.state[flag] = true;
    return { side: side, qty: Math.abs(pos), reduceOnly: true };
  }

  // Risk per trade: 2% of equity, stop at 2.5 ATR.
  const riskCash = ctx.cash * 0.02;
  const stopDist = Math.max(atr * 2.5, price * 0.01);
  const qty = riskCash / stopDist;

  // Regime thresholds on the VIX z-score.
  // z > 1.2 = panic (short), z < -0.6 = calm (long). Band in between = flat.
  const SHORT_Z = 1.2;
  const LONG_Z = -0.6;

  if (pos > 0) {
    const longStop = entry - atr * 2.5;
    ctx.watch([
      { side: 'sell', price: longStop, trigger: 'below', note: 'long stop' },
      { side: 'sell', price: price, trigger: 'below', note: 'calm over' }
    ]);
    if (z > SHORT_Z || price <= longStop) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  if (pos < 0) {
    const shortStop = entry + atr * 2.5;
    ctx.watch([
      { side: 'buy', price: shortStop, trigger: 'above', note: 'short stop' },
      { side: 'buy', price: price, trigger: 'above', note: 'panic over' }
    ]);
    if (z < LONG_Z || price >= shortStop) {
      return { side: 'buy', qty: -pos, reduceOnly: true };
    }
    return null;
  }

  if (ctx.alloc && ctx.alloc.status !== 'ok') { ctx.watch([]); return null; }

  if (z > SHORT_Z) {
    ctx.watch([{ side: 'sell', price: price, trigger: 'below', note: 'panic short' }]);
    return { side: 'sell', qty: qty };
  }
  if (z < LONG_Z) {
    ctx.watch([{ side: 'buy', price: price, trigger: 'above', note: 'calm long' }]);
    return { side: 'buy', qty: qty };
  }
  ctx.watch([]);
  return null;
}
