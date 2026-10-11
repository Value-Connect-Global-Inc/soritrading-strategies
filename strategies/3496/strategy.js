/*
 * @coinsori-strategy v1
 * name: Squeeze Volume Breakout BTC 4h
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: We capture strong trend continuations following volatility contractions (Bollinger squeeze) on 4h BTC charts using volume confirmation and a 50 SMA trend filter.
 * When it buys and sells: Buys when Bollinger Band width is compressed, price breaks above the upper band, and volume is above average. Sells when price drops below the 50 SMA.
 * When it does not work: Range-bound chop with false breakouts.
 */

function onUpdate(ctx) {
  const p = ctx.price;
  const pos = ctx.position;

  const sma50 = ctx.sma(50, 1);
  const bb1 = ctx.bb(20, 2, 1);
  const avgVol = ctx.avgVol(20);

  if (!sma50 || !bb1 || !avgVol) return null;

  if (pos > 0) {
    if (p < sma50) {
      ctx.watch([{ side: 'sell', price: sma50, trigger: 'below', note: 'Exit below 50 SMA' }]);
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  // Squeeze condition using closed bar bb width
  const bandwidth = (bb1.upper - bb1.lower) / bb1.middle;
  const isSqueeze = bandwidth < 0.08;

  // Breakout & Volume
  const isBreakout = p > bb1.upper;
  const vol1 = ctx.volumes.at(-2);
  const isVolumeHigh = vol1 > avgVol * 1.05;
  const trendOk = p > sma50;

  if (isSqueeze && isBreakout && isVolumeHigh && trendOk) {
    const qty = (ctx.cash / p) * 0.99;
    ctx.watch([
      { side: 'buy', price: bb1.upper, trigger: 'above', note: 'Squeeze breakout buy',
        conds: [
          { label: 'Bandwidth', now: bandwidth, op: '<', ref: 0.08, closed: true },
          { label: 'Volume Surge', now: vol1, op: '>', ref: avgVol * 1.05, closed: true },
          { label: 'Above SMA50', ok: true }
        ]
      }
    ]);
    return { side: 'buy', qty: qty };
  }

  ctx.watch([{ side: 'buy', price: bb1.upper, trigger: 'above', note: 'Waiting for squeeze breakout' }]);
  return null;
}
