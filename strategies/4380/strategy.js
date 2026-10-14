/*
 * @coinsori-strategy v1
 * name: Fear-Greed Contrarian Trend
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Crypto sentiment swings to extremes. When the Fear & Greed
 *   index is at extreme fear (<=25) while price still sits above its 200-day
 *   average, the market sold off inside a long-term uptrend — a classic
 *   contrarian buy. We buy the panic and sell into euphoria.
 * When it buys and sells: buys BTC when Fear & Greed <=25 and the close is above
 *   the 200-day SMA; sells when Fear & Greed >=75, the close drops below the
 *   200-day SMA, or a 2.5x ATR hard stop hits.
 * When it does NOT work: in a long bear market price stays below the 200-day SMA
 *   so it never buys (protecting capital but missing the exact bottom); in a
 *   slow grind with no sentiment extremes it sits in cash and underperforms
 *   buy-and-hold. Fear & Greed is a daily signal, so this is a 1-day strategy.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const fg = ctx.data('fear_greed');
  const sma200 = ctx.sma(200, 1);
  const atr = ctx.atr(14, 1);
  if (fg == null || sma200 == null || atr == null || atr <= 0) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const pos = ctx.pos(ctx.sym);

  if (pos > 0) {
    const hardStop = ctx.entryPx - 2.5 * atr;
    if (price <= hardStop) return { side: 'sell', qty: pos };
    if (prevClose < sma200) return { side: 'sell', qty: pos };
    if (fg >= 75) return { side: 'sell', qty: pos };
    ctx.watch([{ side:'sell', price: hardStop, trigger:'below', note:'2.5x ATR stop' },
               { side:'sell', price: sma200, trigger:'below', note:'200-day trend break',
                 conds:[{ label:'Fear&Greed >=75', now: fg, op:'>=', ref:75, closed:true }] }]);
    return null;
  }

  const uptrend = prevClose > sma200;
  ctx.watch([{ side:'buy', price: sma200, trigger:'above', note:'extreme fear + uptrend',
               conds:[{ label:'Fear&Greed <=25', now: fg, op:'<=', ref:25, closed:true },
                      { label:'close > SMA200', ok: uptrend, closed:true }] }]);
  if (fg > 25) return null;
  if (!uptrend) return null;

  const riskCash = ctx.cash * 0.02;
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash / price) * 0.95;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
