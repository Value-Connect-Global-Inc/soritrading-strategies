/*
 * @coinsori-strategy v1
 * name: DXY Macro Regime BTC 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin is a dollar-denominated risk asset that tends to
 * rally when the US dollar weakens and fall when the dollar strengthens. DXY
 * is a smooth, market-driven series (unlike the step-like fed funds rate), so
 * a "dollar below its own 20-day average" regime should produce clean signals.
 * When it buys and sells: buys BTC when the dollar is below its 20-day average
 * (weak dollar) AND price is above its 200-day SMA (no falling knives); sells
 * when the dollar recovers above its 20-day average or a 2xATR stop is hit.
 * When it does NOT work: the dollar-BTC link is a correlation, not a law —
 * BTC can rally on its own (2023-24 ETF bull) while the dollar drifts sideways,
 * and the regime can flip late at turning points.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  // Roll DXY history per BAR (not per tick). ctx.i is the bar index.
  const s = ctx.state;
  if (s.lastBarI !== ctx.i) {
    s.dxyHist = s.dxyHist ?? [];
    const d = ctx.data('dxy');
    if (d != null) s.dxyHist.push(d);
    if (s.dxyHist.length > 20) s.dxyHist.shift();
    s.lastBarI = ctx.i;
  }
  const hist = s.dxyHist;
  if (hist == null || hist.length < 20) return null;

  const cur = hist[hist.length - 1];
  const avg = hist.reduce((a, b) => a + b, 0) / hist.length;
  const weakDollar = cur < avg;

  const pos = ctx.position;
  const atr = ctx.atr(14, 1);
  if (atr == null) return null;

  if (pos > 0) {
    const entry = ctx.entryPx;
    if (entry != null) {
      const stopPx = entry - 2 * atr; // hard stop caps single-position loss
      if (price <= stopPx) return { side: 'sell', qty: pos };
      ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: 'stop: 2xATR' }]);
    }
    if (!weakDollar) return { side: 'sell', qty: pos }; // dollar firming -> risk off
    return null;
  }

  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;
  if (weakDollar && price > sma200) {
    ctx.logOnce('enter weakDollar', cur, avg, 'sma200', sma200);
    ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'enter: weak dollar + trend' }]);
    return { side: 'buy', qty: (ctx.cash / price) * 0.95 };
  }
  return null;
}
