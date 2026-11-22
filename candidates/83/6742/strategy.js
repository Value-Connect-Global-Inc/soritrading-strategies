/*
 * @coinsori-strategy v1
 * name: ETH Dip-Buy Trend 4H
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: In an uptrend, pullbacks to the fast moving average are usually
 * temporary and bounce. We buy those dips with a trend filter and a hard stop,
 * capturing the bounce back to the fast average. This is the same structure as the
 * validated funding-fade family, but on spot (no funding needed) so it can be
 * compared with buy-and-hold.
 * When it buys and sells: BUY when price pulls back to the 20-SMA while the trend
 * (price above the 100-SMA) is up and RSI is oversold-ish; SELL when price bounces
 * back to the 20-SMA or a 2.5x ATR hard stop is hit.
 * When it does NOT work: In a falling market the trend filter keeps us out (good),
 * but a choppy sideways market produces repeated small losses on false dips; a
 * relentless one-way bull with no pullbacks gives few entries and lags holding.
 */
function onUpdate(ctx) {
  const sma20 = ctx.sma(20, 1);
  const sma100 = ctx.sma(100, 1);
  const atr = ctx.atr(14, 1);
  const rsi = ctx.rsi(14, 1);
  if (sma20 == null || sma100 == null || atr == null || rsi == null) return null;

  const prevClose = ctx.closes.at(-2);
  const price = ctx.price;
  const pos = ctx.position || 0;
  const entry = ctx.entryPx;
  const stopDist = 2.5 * atr;                       // same hard-stop width as the validated family

  // ---- exits (price-based, declarable) ----
  if (pos > 0) {
    const stop = (entry == null ? price : entry) - stopDist;
    ctx.watch([
      { side: 'sell', price: sma20, trigger: 'above', note: 'bounce to SMA20' },
      { side: 'sell', price: stop, trigger: 'below', note: 'hard stop' }
    ]);
    if (price >= sma20 || price <= stop) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  // ---- entry: risk 1.5% of cash per trade over the stop distance ----
  const qty = (ctx.cash * 0.015) / stopDist;

  if (prevClose > sma100 && price <= sma20 && rsi < 45) {
    // uptrend + pullback to fast MA + RSI not overbought -> buy the dip
    ctx.watch([{ side: 'buy', price: sma20, trigger: 'below', note: 'dip to SMA20',
      conds: [
        { label: 'RSI(14) close', now: rsi, op: '<', ref: 45, closed: true },
        { label: 'above SMA100', ok: prevClose > sma100 }
      ] }]);
    return { side: 'buy', qty };
  }

  ctx.watch([]);
  return null;
}
