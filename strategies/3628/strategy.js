/*
 * @coinsori-strategy v1
 * name: ETH Dual-Regime Trend 4H
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: crypto breakouts are most durable when BOTH the macro
 *   backdrop and the network's real usage are healthy — a weak dollar means
 *   money is not fleeing crypto, and rising active addresses mean the rally
 *   is driven by actual use, not just speculation. Requiring both filters
 *   should cut out the breakouts that fail because one leg is missing.
 * When it buys and sells: buy a 20-bar high close above the 100-EMA with
 *   above-average volume, only when DXY is below its 30-day average AND active
 *   addresses are above their 30-day average. Sell on a 20-bar low close, a
 *   2.5x ATR hard stop, or a close back below the 100-EMA.
 * When it does NOT work: two gates together fire rarely, so it can sit out
 *   strong moves where only one regime is healthy, and the added filtering
 *   mostly removes trades rather than improving the ones that remain.
 */
function onUpdate(ctx) {
  const atr = ctx.atr(14, 1);
  const ema100 = ctx.ema(100, 1);
  if (atr == null || ema100 == null) return null;
  const price = ctx.price;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  // dollar regime: DXY below its 30-day average
  const dxy = ctx.data('dxy');
  let hist = ctx.state.dxyHist || [];
  if (dxy != null) { hist.push(dxy); if (hist.length > 210) hist = hist.slice(-210); }
  ctx.state.dxyHist = hist;
  const dxyAvg = hist.length >= 31 ? hist.slice(-30).reduce((a, b) => a + b, 0) / 30 : null;
  const dollarOk = dxyAvg != null && dxy != null && dxy <= dxyAvg;

  // on-chain regime: active addresses above their 30-day average
  const addr = ctx.data('addr');
  const addrAvg = ctx.data('addr_sma30');
  const onChainOk = addr != null && addrAvg != null && addr > addrAvg;

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

  if (!dollarOk) return null;     // macro gate
  if (!onChainOk) return null;    // on-chain gate
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
