/*
 * @coinsori-strategy v1
 * name: BTC DXY-Gated Trend 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: A falling US dollar (DXY below its own recent average)
 *   is usually risk-on and favors crypto breakouts; a strengthening dollar
 *   is risk-off and breakouts tend to fail. This is a macro regime filter
 *   on top of a simple trend engine.
 * When it buys and sells: buy a 20-bar high close above the 100-EMA only
 *   when DXY is below its ~30-day average. Sell on a 20-bar low close, a
 *   2.5x ATR hard stop, or a close back below the 100-EMA.
 * When it does NOT work: DXY is slow and can stay weak while crypto falls
 *   for its own reasons; the gate also sits out strong crypto rallies in
 *   dollar-strengthening regimes.
 */
function onUpdate(ctx) {
  const atr = ctx.atr(14, 1);
  const ema100 = ctx.ema(100, 1);
  if (atr == null || ema100 == null) return null;
  const price = ctx.price;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const dxy = ctx.data('dxy');            // US dollar index (daily value from user's dataset)
  if (dxy == null) return null;

  // Keep a rolling buffer of DXY values to build our own ~30-day average.
  const st = ctx.state || {};
  const hist = st.dxyHist || [];
  hist.push(dxy);
  if (hist.length > 180) hist.shift();    // 4h bars: 180 bars = 30 days
  ctx.state = { dxyHist: hist };
  if (hist.length < 90) return null;      // need at least ~15 days of history to judge the trend

  let sum = 0;
  for (let i = 0; i < hist.length; i++) sum += hist[i];
  const dxyAvg = sum / hist.length;
  const gateOk = dxy < dxyAvg;            // relative gate: dollar weakening vs its own recent average

  if (ctx.position > 0) {
    const hardStop = ctx.entryPx - 2.5 * atr;
    const ll20 = ctx.low(20, 2);
    if (price <= hardStop) return { side: 'sell', qty: ctx.position };
    if (ll20 != null && prevClose <= ll20) return { side: 'sell', qty: ctx.position };
    if (prevClose < ema100) return { side: 'sell', qty: ctx.position };
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2.5x ATR hard stop' },
               { side: 'sell', price: ll20, trigger: 'below', note: '20-bar channel exit' },
               { side: 'sell', price: ema100, trigger: 'below', note: '100-EMA trend break' }]);
    return null;
  }

  if (!gateOk) return null;   // macro gate: only buy while the dollar is weakening
  if (prevClose <= ema100) return null;
  const hh20 = ctx.high(20, 2);
  if (hh20 == null || prevClose <= hh20) return null;
  const volPrev = ctx.volPrev;
  const avgVol = ctx.avgVol(20);
  if (volPrev == null || avgVol == null || avgVol <= 0) return null;
  if (volPrev < avgVol) return null;

  const riskCash = ctx.cash * 0.02;
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.99) / price;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
