/*
 * @coinsori-strategy v1
 * name: Fear-Greed Contrarian Dip Buyer
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Crypto sentiment swings to extremes. When the Fear & Greed
 *   index falls to extreme fear (<=25) while price is still above its 200-day
 *   average, that is panic selling inside an uptrend — historically a good dip
 *   entry. We buy the dip and take profit when greed returns (>=70), the trend
 *   breaks (close below the 200-day SMA), or a hard 2.5x ATR stop hits.
 * When it buys and sells: buy BTC when Fear & Greed <=25 AND the previous close
 *   is above the 200-day SMA. Sell when Fear & Greed reaches >=70, the close
 *   drops below the 200-day SMA, or price hits the 2.5x ATR stop.
 * When it does NOT work: in a long bear market (price below the 200-day SMA) it
 *   sits in cash and misses the eventual bottom; in a V-shaped crash the 2.5x
 *   ATR stop limits but does not erase the loss. It also misses steady bull
 *   markets that never show extreme fear.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const fg = ctx.data('fear_greed');           // 0..100, daily sentiment
  const sma200 = ctx.sma(200, 1);
  const atr = ctx.atr(14, 1);
  if (fg == null || sma200 == null || atr == null || atr <= 0) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const pos = ctx.pos(ctx.sym);

  if (pos > 0) {
    const hardStop = ctx.entryPx - 2.5 * atr;
    if (price <= hardStop) return { side: 'sell', qty: pos };
    if (prevClose < sma200) return { side: 'sell', qty: pos };  // uptrend gone, don't ride a bear
    if (fg >= 70) return { side: 'sell', qty: pos };            // greed = take the profit
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2.5x ATR stop' },
               { side: 'sell', price: sma200, trigger: 'below', note: '200-day trend break',
                 conds: [{ label: 'Fear&Greed >=70', now: fg, op: '>=', ref: 70, closed: true }] }]);
    return null;
  }

  // Buy only at extreme fear inside an uptrend
  ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'uptrend + extreme fear',
               conds: [{ label: 'Fear&Greed <=25', now: fg, op: '<=', ref: 25, closed: true },
                       { label: 'close > 200-SMA', ok: prevClose > sma200, closed: true }] }]);
  if (fg > 25) return null;                 // only buy at extreme fear
  if (prevClose <= sma200) return null;     // only buy inside an uptrend

  const riskCash = ctx.cash * 0.02;         // risk 2% of cash per trade
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash / price) * 0.95;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
