/*
 * @coinsori-strategy v1
 * name: BTC NDX Risk-On Short 4H
 * ex: binanceusdm
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Bitcoin trades like a high-beta risk asset: when
 * equities (here the NASDAQ-100 index) are in an uptrend, risk appetite is
 * high and BTC tends to rise; when equities roll over, risk-off hits BTC
 * harder. Using the equity trend as a regime filter lets us trade BOTH
 * directions — long when risk is on, short when risk is off.
 * When it buys and sells: We compare the NASDAQ-100 index to its own recent
 * average. Above it (risk-on) we go long BTC; below it (risk-off) we short
 * BTC. A 2.5-ATR stop protects every position.
 * When it does NOT work: When crypto decouples from equities (e.g. a
 * crypto-specific rally or crash unrelated to stocks), the NDX filter points
 * the wrong way. NDX is daily data with a 2-day lag, so it cannot react to
 * intraday crypto moves and the trend flip lags the actual turn.
 */
function onUpdate(ctx) {
  ctx.state = ctx.state || {};
  if (!ctx.state.warm) { ctx.state.warm = true; ctx.watch([]); return null; }

  const pos = ctx.position || 0;
  const entry = ctx.entryPx;
  const price = ctx.price;
  if (price == null) { ctx.watch([]); return null; }

  const ndx = ctx.data("base.ndx");
  if (ndx == null) { ctx.watch([]); return null; }

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

  // Build a rolling series of NDX values to get its z-score.
  // NDX is daily data on 4h bars, so consecutive bars repeat the same value.
  ctx.state.ndxHist = ctx.state.ndxHist || [];
  ctx.state.ndxHist.push(ndx);
  if (ctx.state.ndxHist.length > 60) ctx.state.ndxHist.shift();
  const hist = ctx.state.ndxHist;
  if (hist.length < 50) { ctx.watch([]); return null; }

  const last50 = hist.slice(-50);
  const mean = last50.reduce((a, b) => a + b, 0) / last50.length;
  const variance = last50.reduce((a, b) => a + (b - mean) * (b - mean), 0) / last50.length;
  const sd = Math.sqrt(variance);
  if (sd <= 0) { ctx.watch([]); return null; }
  const z = (ndx - mean) / sd;

  const riskOn = z > 0;   // NDX above its own recent mean = risk-on
  const riskOff = z < 0;  // NDX below its own recent mean = risk-off

  if (pos > 0) {
    const longStop = entry - atr * 2.5;
    ctx.watch([
      { side: 'sell', price: longStop, trigger: 'below', note: 'long stop' },
      { side: 'sell', price: price, trigger: 'below', note: 'risk off' }
    ]);
    if (riskOff || price <= longStop) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  if (pos < 0) {
    const shortStop = entry + atr * 2.5;
    ctx.watch([
      { side: 'buy', price: shortStop, trigger: 'above', note: 'short stop' },
      { side: 'buy', price: price, trigger: 'above', note: 'risk on' }
    ]);
    if (riskOn || price >= shortStop) {
      return { side: 'buy', qty: -pos, reduceOnly: true };
    }
    return null;
  }

  if (ctx.alloc && ctx.alloc.status !== 'ok') { ctx.watch([]); return null; }

  if (riskOff) {
    ctx.watch([{ side: 'sell', price: price, trigger: 'below', note: 'risk-off short' }]);
    return { side: 'sell', qty: qty };
  }
  if (riskOn) {
    ctx.watch([{ side: 'buy', price: price, trigger: 'above', note: 'risk-on long' }]);
    return { side: 'buy', qty: qty };
  }
  ctx.watch([]);
  return null;
}
