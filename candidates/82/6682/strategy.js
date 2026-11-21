/*
 * @coinsori-strategy v1
 * name: BTC Macro-Gated Trend 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Bitcoin trends are strong but crash hard when global risk appetite turns off. Using the NASDAQ-100 index (a daily risk-on/off gauge) as a regime filter lets the strategy ride BTC's uptrend when risk appetite is on and step aside when it is off, cutting the drawdown that buy-and-hold suffers in crypto winters.
 * When it buys and sells: buys when the 4h close is above its 50-bar EMA and the NASDAQ-100 is above its own recent average (risk-on). Sells when the close drops below the 50 EMA, or when a trailing stop (3x ATR, capped 15% below the highest close since entry) is hit.
 * When it does NOT work: in a sideways market the EMA crosses repeatedly and fees eat the account; if Bitcoin rallies while stocks are weak (a crypto-only melt-up) the macro gate keeps it flat and it misses the move; the NASDAQ data arrives with a 2-day lag so the gate can be slow to flip.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const ema50_1 = ctx.ema(50, 1);
  const atr1 = ctx.atr(14, 1);
  const close1 = ctx.closes.at(-2);
  if (price == null || ema50_1 == null || atr1 == null || atr1 <= 0 || close1 == null) {
    ctx.watch([]);
    return null;
  }

  // Risk-on/off gauge: NDX vs its own rolling mean (~50 trading days), stored in shared state.
  const ndx = ctx.data('base_ndx');
  const arr = ctx.state.ndxArr || [];
  if (ndx != null) {
    arr.push(ndx);
    if (arr.length > 300) arr.shift();
  }
  ctx.state.ndxArr = arr;
  let riskOn = null;
  if (ndx != null && arr.length >= 200) {
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    riskOn = ndx >= mean;
  }

  const pos = ctx.position;
  const allocOk = !ctx.alloc || ctx.alloc.status === 'ok';
  const uptrend = close1 > ema50_1;

  if (pos > 0) {
    const highSince = ctx.state.highSince || close1;
    const newHigh = Math.max(highSince, close1);
    ctx.state.highSince = newHigh;
    const stop = Math.max(newHigh - 3 * atr1, newHigh * 0.85); // trail 3 ATR, capped 15% below peak
    const trendBroken = close1 < ema50_1;
    ctx.watch([
      { side: 'sell', price: stop, trigger: 'below', note: 'trailing stop' },
      { side: 'sell', price: ema50_1, trigger: 'below', note: 'EMA50 break' }
    ]);
    if (close1 < stop || trendBroken) {
      ctx.state.highSince = 0;
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  ctx.state.highSince = 0;
  if (riskOn == null) { ctx.watch([]); return null; }
  ctx.watch([{ side: 'buy', price: ema50_1, trigger: 'above', note: 'long trend',
    conds: [{ label: 'NDX>=own mean', ok: riskOn }] }]);
  if (allocOk && uptrend && riskOn) {
    ctx.state.highSince = close1;
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  return null;
}
