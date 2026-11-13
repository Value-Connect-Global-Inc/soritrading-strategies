/*
 * @coinsori-strategy v1
 * name: ETH Calm-Pullback Mean Reversion 4H
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: In an uptrend, ETH pullbacks tend to revert UP when volatility is normal, but cascade when volatility is high. This strategy buys short-term oversold pullbacks inside a 200-bar uptrend, but only when ATR is calm relative to its own recent median — mean reversion works in calm regimes and breaks in panic.
 * When it buys and sells: buys when the previous bar's RSI(2) is deeply oversold (<10) while price is above the 200-bar average and ATR is below 1.2x its 60-bar median; sells when RSI(2) recovers above 60, price closes below the 200-bar average (the pullback became a reversal), or a 2.5x ATR stop below entry is hit.
 * When it does NOT work: in a sustained high-volatility market the calm filter keeps it flat (misses the move); in a bear market the uptrend filter blocks entries so it just sits in cash. Deep oversold bounces in a real crash keep triggering and losing until the stop.
 */
function onUpdate(ctx) {
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;

  const rsi2 = ctx.rsi(2, 1);
  if (rsi2 == null) return null;

  const atr = ctx.atr(14, 1);
  if (atr == null) return null;

  // Rolling ATR history -> median, same calm-regime idea that worked on BTC trend.
  const hist = ctx.state.atrHist || [];
  hist.push(atr);
  if (hist.length > 120) hist.shift();
  ctx.state.atrHist = hist;
  if (hist.length < 60) { ctx.watch([]); return null; }
  const sorted = [...hist].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const calm = atr < median * 1.2;

  const enterLvl = sma200 * 1.0;
  const exitLvl = sma200 * 0.98;

  if (ctx.position <= 0) {
    ctx.watch([{
      side: 'buy', price: enterLvl, trigger: 'above', note: 'oversold in uptrend',
      conds: [
        { label: 'RSI(2)', now: Math.round(rsi2 * 100) / 100, op: '<', ref: 10, closed: true },
        { label: 'ATR calm', ok: calm }
      ]
    }]);
    if (prevClose > sma200 && rsi2 < 10 && calm) {
      // size so a 2.5x ATR stop loses ~1% of equity
      const qtyByRisk = (0.01 * ctx.cash) / (2.5 * atr);
      const qtyByCash = (ctx.cash / ctx.price) * 0.98;
      return { side: 'buy', qty: Math.min(qtyByRisk, qtyByCash) };
    }
    return null;
  }

  const stop = ctx.entryPx != null ? ctx.entryPx - 2.5 * atr : null;
  ctx.watch([
    { side: 'sell', price: exitLvl, trigger: 'below', note: 'trend broke' },
    { side: 'sell', price: ctx.price, trigger: 'above', note: 'RSI recovery',
      conds: [{ label: 'RSI(2)', now: Math.round(rsi2 * 100) / 100, op: '>', ref: 60, closed: true }] },
    ...(stop != null ? [{ side: 'sell', price: stop, trigger: 'below', note: '2.5xATR stop' }] : [])
  ]);
  if (prevClose < exitLvl || rsi2 > 60 || (stop != null && ctx.price <= stop)) {
    return { side: 'sell', qty: ctx.position, reduceOnly: true };
  }
  return null;
}
