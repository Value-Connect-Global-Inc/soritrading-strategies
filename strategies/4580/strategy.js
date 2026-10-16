/*
 * @coinsori-strategy v1
 * name: BTC Dollar-Regime Macro Filter
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: the US dollar is the single biggest macro driver for
 * crypto. When the dollar is weak (index below its long-term average), money
 * flows out of USD into risk assets like Bitcoin and rallies persist; when the
 * dollar strengthens, crypto tends to fall. This trades the macro regime
 * instead of price or sentiment, using the Fed trade-weighted dollar index.
 * When it buys and sells: buy BTC when the dollar index is BELOW its 200-day
 * average (weak-dollar regime) AND price is above its 200-day average (BTC
 * uptrend intact). Sell when the dollar index rises back above its 200-day
 * average (risk-off regime), or when price drops 25% below entry (hard stop).
 * When it does NOT work: the dollar index is slow-moving, so entries/exits lag
 * sharp crypto crashes that are driven by crypto-internal shocks (hacks,
 * leverage cascades) rather than the dollar. In such crashes the stop is the
 * only protection. In a flat-dollar bull run the filter adds nothing.
 */
const DXY_N = 200;
let dxyHist = []; // rolling window of the last DXY_N dollar-index values

function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  // ctx.data returns strings — coerce to number. Missing data = no trade.
  const dxy = Number(ctx.data('dxy'));
  if (!Number.isFinite(dxy)) return null;

  // Maintain a rolling window of dollar values to get its long-term average.
  dxyHist.push(dxy);
  if (dxyHist.length > DXY_N) dxyHist.shift();

  const pos = ctx.position;
  if (pos > 0) {
    const entry = ctx.entryPx;
    if (entry != null) {
      // 25% hard stop: caps the loss on the position.
      if (price <= entry * 0.75) return { side: 'sell', qty: pos };
      ctx.watch([{ side: 'sell', price: entry * 0.75, trigger: 'below', note: 'stop: -25%' }]);
    }
    // Exit: dollar strengthening above its long-term average = risk-off.
    if (dxyHist.length >= DXY_N && dxy > avg(dxyHist)) return { side: 'sell', qty: pos };
    return null;
  }

  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;
  if (dxyHist.length < DXY_N) return null;
  const dxyAvg = avg(dxyHist);

  // Entry: weak-dollar regime + BTC uptrend intact.
  if (dxy < dxyAvg && price > sma200) {
    // Fixed 95% sizing — matches the proven baseline sizing.
    return { side: 'buy', qty: (ctx.cash / price) * 0.95 };
  }

  ctx.watch([{
    side: 'buy',
    price: sma200,
    trigger: 'above',
    note: 'enter: weak dollar & trend up',
    conds: [{ label: 'Dollar below 200d avg', ok: dxy < dxyAvg }]
  }]);
  return null;
}

function avg(a) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i];
  return s / a.length;
}
