/*
 * @coinsori-strategy v1
 * name: BTC Long-Only Trend 4H Spot
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Bitcoin trends strongly upward in bull phases. Being
 * long only during clear uptrends and stepping aside in downtrends captures
 * most of the upside with a much smaller drawdown than buying and holding.
 * When it buys and sells: When the fast EMA(50) is above the slow EMA(200)
 * and price is above the slow EMA, buy. Exit when the trend flips bearish or
 * price falls to a 2.5-ATR stop. We risk only a small slice of equity per
 * trade.
 * When it does NOT work: In a choppy sideways market the trend flips often,
 * producing many small losing trades that pay fees each time. It also misses
 * gains if a strong rally starts while we are flat waiting for the EMA to
 * confirm.
 */
function onUpdate(ctx) {
  ctx.state = ctx.state || {};

  // First tick after a restart: send nothing while the restored position and
  // entry price reconcile. After that we manage the position from ctx.position.
  if (!ctx.state.warm) {
    ctx.state.warm = true;
    ctx.watch([]);
    return null;
  }

  const pos = ctx.position || 0;
  const entry = ctx.entryPx;

  const emaFast = ctx.ema(50, 1);
  const emaSlow = ctx.ema(200, 1);
  if (emaFast == null || emaSlow == null) { ctx.watch([]); return null; }

  const prevClose = ctx.closes.at(-2);
  const price = ctx.price;
  if (prevClose == null || price == null) { ctx.watch([]); return null; }

  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0) { ctx.watch([]); return null; }

  // A restored position with no entry price after a restart: close it cleanly,
  // once (flag in ctx.state), so we never hold an unknown-cost position.
  if (pos !== 0 && entry == null) {
    const side = pos > 0 ? 'sell' : 'buy';
    const flag = 'restartClose_' + side;
    ctx.watch([{ side: side, price: price, trigger: pos > 0 ? 'below' : 'above', note: 'restart close' }]);
    if (ctx.state[flag]) return null;
    ctx.state[flag] = true;
    return { side: side, qty: Math.abs(pos), reduceOnly: true };
  }

  const bullish = emaFast > emaSlow && prevClose > emaSlow;

  const riskCash = ctx.cash * 0.05;
  const stopDist = Math.max(atr * 2.5, price * 0.01);
  const qty = riskCash / stopDist;

  // If we hold a long position, exit on a bearish trend flip or the stop.
  if (pos > 0) {
    const longStop = entry - atr * 2.5;
    ctx.watch([
      { side: 'sell', price: emaSlow, trigger: 'below', note: 'trend flipped' },
      { side: 'sell', price: longStop, trigger: 'below', note: 'long stop' }
    ]);
    if (!bullish || prevClose <= entry - atr * 2.5) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  // If we somehow hold a short (restored), close it and stay flat — this
  // strategy is long-only.
  if (pos < 0) {
    ctx.watch([{ side: 'buy', price: price, trigger: 'above', note: 'close short' }]);
    return { side: 'buy', qty: -pos, reduceOnly: true };
  }

  // Flat: only buy on a confirmed uptrend, and only when the allocator is ok.
  if (ctx.alloc && ctx.alloc.status !== 'ok') {
    ctx.watch([]);
    return null;
  }
  if (bullish) {
    ctx.watch([{ side: 'buy', price: emaSlow, trigger: 'above', note: 'long entry' }]);
    if (qty > 0) return { side: 'buy', qty: qty };
  } else {
    ctx.watch([]);
  }
  return null;
}
