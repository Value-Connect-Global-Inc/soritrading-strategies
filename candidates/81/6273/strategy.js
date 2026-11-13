/*
 * @coinsori-strategy v1
 * name: FearGreed Contrarian Trend 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: the Crypto Fear & Greed Index (0-100, daily) is a crowd
 * sentiment thermometer. When it is far below its own recent average (panic),
 * the crowd has capitulated — in a bull trend that is a dip to buy. When it is
 * far above its own average (euphoria) the crowd is crowded long — time to exit.
 * This is a sentiment-contrarian edge, a different family from funding rates and
 * from the VIX/ATR regime trend.
 * When it buys and sells: it buys when the Fear & Greed z-score (vs its own
 * trailing history) is below -1.0 AND the 4h close is above its 200-bar average
 * (buy the panic dip, not the falling knife). It sells when the z-score turns
 * strongly positive (crowd euphoric), the close falls below the 200-bar average,
 * or price drops 5xATR below the best high since entry.
 * When it does NOT work: in a bear market the panic-dip entries are catching
 * knives and the trend filter is the only protection; the daily index is slow so
 * it lags fast reversals. If the index data is missing it stays flat.
 */

function onUpdate(ctx) {
  const price = ctx.price;
  const pos = ctx.position || 0;
  const fg = ctx.data('main.fear_greed');

  // Distinct daily observations (the index updates once a day, repeats across 4h bars).
  const hist = ctx.state.fgHist || [];
  if (fg != null && fg > 0) {
    const last = hist[hist.length - 1];
    if (last == null || Math.abs(last - fg) > 1e-9) {
      hist.push(fg);
      if (hist.length > 120) hist.shift();
      ctx.state.fgHist = hist;
    }
  }
  // Use only SETTLED observations (drop the newest, possibly forming one).
  const n = hist.length;
  const settled = hist.slice(0, n - 1);
  let fgZ = null;
  if (settled.length >= 30 && n >= 2) {
    const m = settled.reduce((a, b) => a + b, 0) / settled.length;
    const sd = Math.sqrt(settled.reduce((a, b) => a + (b - m) * (b - m), 0) / settled.length) || 1;
    const fgUse = hist[n - 2];
    if (fgUse != null) fgZ = (fgUse - m) / sd;
  }

  const sma200 = ctx.sma(200, 1);
  const prevClose = ctx.closes.at(-2);
  if (sma200 == null || prevClose == null) { ctx.watch([]); return null; }

  if (pos > 0) {
    const atrNow = ctx.atr(14, 1);
    const hh = ctx.state.hh != null ? Math.max(ctx.state.hh, price) : price;
    ctx.state.hh = hh;
    const stop = atrNow != null ? hh - 5 * atrNow : sma200 * 0.9;
    const exitPx = Math.max(sma200 * 0.97, stop);
    const greedExit = fgZ != null && fgZ > 1.0;
    ctx.watch([
      { side: 'sell', price: exitPx, trigger: 'below', note: 'Trend/stop exit' },
      { side: 'sell', price: price, trigger: 'below', note: 'Greed exit', conds: [{ label: 'FG z', now: fgZ, op: '>', ref: 1.0 }] }
    ]);
    if (greedExit || prevClose <= exitPx) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  if (ctx.closes.length < 220) { ctx.watch([]); return null; }
  // Panic dip in a bull trend: FG z below -1.0 while close is above its 200-bar average.
  if (fgZ != null && fgZ < -1.0 && prevClose > sma200) {
    ctx.state.hh = price;
    const atrNow = ctx.atr(14, 1);
    // Risk 4% of equity over the 5xATR stop distance, capped at full cash.
    let qty = ctx.cash / price * 0.99;
    if (atrNow != null && atrNow > 0) qty = Math.min(qty, (ctx.cash * 0.04) / (5 * atrNow));
    ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'Panic dip in uptrend', conds: [{ label: 'FG z', now: fgZ, op: '<', ref: -1.0 }] }]);
    return { side: 'buy', qty };
  }
  ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'Panic dip in uptrend', conds: [{ label: 'FG z', now: fgZ, op: '<', ref: -1.0 }] }]);
  return null;
}
