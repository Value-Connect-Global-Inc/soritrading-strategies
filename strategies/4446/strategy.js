/*
 * @coinsori-strategy v1
 * name: DXY Gate BTC Trend
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin rallies when the US dollar weakens (risk-on flows); this strategy only goes long when the dollar is falling, so it skips dollar-strength bear regimes.
 * When it buys and sells: Buys when BTC is above its 50-day average AND the dollar index has fallen over the last 5 days; sells when price drops back below the 50-day average, or a 15% stop loss is hit.
 * When it does NOT work: In choppy sideways markets where BTC and the dollar move together, or if the dollar falls while BTC also falls (liquidity squeeze), the filter adds no edge and whipsaws.
 */
function onUpdate(ctx) {
  const px = ctx.price;
  const sma50 = ctx.sma(50, 1);
  if (sma50 == null) return null;

  const dxy = ctx.data('dxy');
  if (dxy == null) return null;

  // keep a short DXY history so we can measure 5-day dollar momentum
  const hist = ctx.state.dxyHist || [];
  hist.push(dxy);
  if (hist.length > 6) hist.shift();
  ctx.state.dxyHist = hist;
  if (hist.length < 6) return null;

  const dxy5 = (hist[hist.length - 1] - hist[0]) / hist[0]; // negative = dollar weakening
  const trendUp = px > sma50;
  const dollarFalling = dxy5 < 0;

  if (ctx.position <= 0) {
    if (trendUp && dollarFalling) {
      ctx.watch([{ side:'sell', price: sma50, trigger:'below', note:'SMA50 trend' },
                 { side:'sell', price: px * 0.85, trigger:'below', note:'15% stop' }]);
      return { side:'buy', qty: ctx.cash / px * 0.99 };
    }
    ctx.watch([{ side:'buy', price: sma50, trigger:'above', note:'SMA50 + $ falling',
                 conds:[{ label:'DXY 5d mom', now: dxy5, op:'<', ref:0, closed:true }] }]);
    return null;
  }

  // exit only on trend flip or hard stop (NOT on DXY flip) to avoid churning on a noisy 5-day signal
  const entryPx = ctx.entryPx;
  const stopPx = entryPx != null ? entryPx * 0.85 : null;
  const stopHit = stopPx != null && px <= stopPx;
  const exit = !trendUp || stopHit;

  const w = [{ side:'sell', price: sma50, trigger:'below', note:'SMA50 trend' }];
  if (stopPx != null) w.push({ side:'sell', price: stopPx, trigger:'below', note:'15% stop' });
  ctx.watch(w);

  if (exit) return { side:'sell', qty: ctx.position };
  return null;
}
