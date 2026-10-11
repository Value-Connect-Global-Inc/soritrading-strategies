/*
 * @coinsori-strategy v1
 * name: Squeeze Volume Breakout ATR BTC 4h
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: We bet on explosive market expansion following periods of moderate volatility contraction (Bollinger squeeze), enhanced by volume surge and MACD momentum confirmation.
 * When it buys and sells: Buys when Bollinger Band width contracts, price breaks above the upper band, volume exceeds average, and MACD shows positive momentum. Sells when price drops below the 50 SMA or MACD turns negative.
 * When it does not work: Suffers in choppy range-bound markets with fake breakouts that trigger immediate reversals.
 */

function onUpdate(ctx) {
  const p = ctx.price;
  const pos = ctx.position;

  const sma50 = ctx.sma(50, 1);
  const bb1 = ctx.bb(20, 2, 1);
  const bbPrev = ctx.bb(20, 2, 2);
  const rsi1 = ctx.rsi(14, 1);
  const macd1 = ctx.macd(12, 26, 9, 1);
  const macd2 = ctx.macd(12, 26, 9, 2);
  const atr1 = ctx.atr(14, 1);
  const avgVol5 = ctx.avgVol(20);

  if (!sma50 || !bb1 || !bbPrev || !rsi1 || !macd1 || !macd2 || !atr1 || !avgVol5) return null;

  if (pos > 0) {
    if (p < sma50 || macd1.macd < macd1.signal) {
      ctx.watch([{ side: 'sell', price: p, trigger: 'below', note: 'Exit condition met' }]);
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  // Relaxed squeeze condition: width is relatively low compared to recent bars
  const width1 = (bb1.upper - bb1.lower) / bb1.middle;
  const widthPrev = (bbPrev.upper - bbPrev.lower) / bbPrev.middle;
  const isSqueeze = width1 < widthPrev || width1 < 0.08;

  const vol1 = ctx.volumes.at(-2);
  const isVolumeHigh = vol1 > avgVol5 * 1.05;

  const isBreakout = p > bb1.upper && ctx.closes.at(-2) > bb1.upper;
  const trendOk = p > sma50;
  const macdOk = macd1.macd > macd1.signal;

  if (isSqueeze && isBreakout && isVolumeHigh && trendOk && macdOk) {
    const qty = (ctx.cash / p) * 0.99;
    ctx.watch([
      { side: 'buy', price: bb1.upper, trigger: 'above', note: 'Squeeze Breakout entry', 
        conds: [
          { label: 'BB Squeeze', now: width1, op: '<', ref: 0.08, closed: true },
          { label: 'RSI > 50', now: rsi1, op: '>', ref: 50, closed: true },
          { label: 'MACD bullish', ok: true }
        ]
      }
    ]);
    return { side: 'buy', qty: qty };
  }

  ctx.watch([{ side: 'buy', price: bb1.upper, trigger: 'above', note: 'Waiting for squeeze breakout' }]);
  return null;
}
