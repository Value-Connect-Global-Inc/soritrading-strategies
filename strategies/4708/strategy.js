/*
 * @coinsori-strategy v1
 * name: BTC Macro Weak-Dollar Trend 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin rallies when global liquidity is easy, which shows up as a
 * weakening US dollar index. We only hold BTC when the long-term trend is up (price above
 * the 200-day EMA) AND the dollar index is below its own 90-day average (weak dollar).
 * When it buys and sells: buys when a closed daily bar closes above the 200-day EMA while
 * the dollar index is below its 90-day average. Sells when price closes back below the
 * 200-day EMA, when the dollar climbs back above its 90-day average, or on a 3x ATR stop.
 * When it does NOT work: when BTC trends up while the dollar also strengthens (e.g. the
 * 2024-25 ETF-driven rally with a firm dollar), it stays flat and misses the gains. It also
 * whipsaws in sideways markets where price straddles the 200-day EMA. DXY is business-days
 * only, so weekend bars use the last known weekday value.
 */
const dxyHist = [];
let lastDxy = null;

function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const c = ctx.closes;
  if (c.length < 220) return null; // need 200 bars for EMA200 + margin

  const ema200 = ctx.ema(200, 1);
  if (ema200 == null) return null;
  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0) return null;

  // Dollar index is business-days only: carry forward the last known value
  const dxyNow = ctx.data('dxy');
  if (dxyNow != null && Number.isFinite(dxyNow) && dxyNow > 0) {
    lastDxy = dxyNow;
    dxyHist.push(dxyNow);
    if (dxyHist.length > 90) dxyHist.shift();
  }

  const pos = ctx.position;

  // If we have no DXY history yet, fall back to a pure 200-day EMA trend strategy
  // so the strategy is not dead when the dataset is unavailable.
  let weakDollar = null;
  if (lastDxy != null && dxyHist.length >= 60) {
    let sum = 0;
    for (let i = 0; i < dxyHist.length; i++) sum += dxyHist[i];
    weakDollar = lastDxy < sum / dxyHist.length;
  }

  const prevClose = c.at(-2); // last CLOSED bar

  if (pos > 0) {
    const stop = ctx.entryPx == null ? null : ctx.entryPx - atr * 3;
    if (stop != null && price <= stop) return { side: 'sell', qty: pos };
    if (prevClose < ema200) return { side: 'sell', qty: pos };
    // exit if dollar regime turns against us (only when we know it)
    if (weakDollar === false) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '3x ATR stop' },
               { side: 'sell', price: ema200, trigger: 'below', note: '200d EMA breakdown' }]);
    return null;
  }

  const trendUp = prevClose > ema200;
  // entry requires uptrend AND weak dollar; if DXY unknown, allow trend-only entry
  const canBuy = trendUp && (weakDollar === true || weakDollar === null);

  if (!canBuy) {
    ctx.watch([{ side: 'buy', price: ema200, trigger: 'above', note: '200d EMA reclaim',
                 conds: [{ label: 'DXY weak', ok: weakDollar === true, closed: true }] }]);
    return null;
  }

  const qty = (ctx.cash * 0.99) / price;
  if (qty <= 0) return null;
  ctx.watch([{ side: 'buy', price: ema200, trigger: 'above', note: '200d EMA reclaim',
               conds: [{ label: 'DXY weak', ok: weakDollar === true, closed: true }] }]);
  return { side: 'buy', qty };
}
