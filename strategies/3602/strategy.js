/*
 * @coinsori-strategy v1
 * name: Sentiment Trend Rider
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Crypto is driven by crowd emotion — fear marks cheap entries
 * inside an uptrend, euphoria marks good exits. This strategy rides the long-term
 * trend but only buys when the Fear & Greed index says the crowd is scared.
 * When it buys and sells: buys when the close is above its 200-day average AND the
 * Fear & Greed index is below 45 (fear). Sells when the close falls back below the
 * 200-day average, or Fear & Greed climbs above 72 (greed), or price drops 3x ATR
 * below the entry (hard stop).
 * When it does NOT work: in a long bear market it sits in cash (safe but flat); in
 * a sideways chop it may buy dips that keep falling. It needs the Fear & Greed data
 * (available from 2018) — without it the strategy never trades.
 */
function onUpdate(ctx) {
  const sma200 = ctx.sma(200, 1);
  const atr = ctx.atr(14, 1);
  const fg = ctx.data('fear_greed');
  if (sma200 == null || atr == null || fg == null) return null;
  const prevClose = ctx.closes.at(-2); // last CLOSED bar — same in backtest and live
  if (prevClose == null) return null;

  const inPos = ctx.position > 0;

  if (inPos) {
    // hard stop: 3x ATR below entry — caps the loss on any single trade
    const hardStop = ctx.entryPx - 3 * atr;
    if (prevClose <= hardStop) return { side: 'sell', qty: ctx.position };
    // long-term trend broken — get out, don't argue with a dead trend
    if (prevClose < sma200) return { side: 'sell', qty: ctx.position };
    // crowd euphoric — take profit before the top
    if (fg > 72) return { side: 'sell', qty: ctx.position };
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '3x ATR hard stop' },
               { side: 'sell', price: sma200, trigger: 'below', note: 'trend broken' },
               { side: 'sell', price: prevClose, trigger: 'above', note: 'euphoria exit',
                 conds: [{ label: 'Fear&Greed', now: fg, op: '>', ref: 72, closed: true }] }]);
    return null;
  }

  // entry: long-term uptrend intact AND crowd scared — buy the fear, not the euphoria
  if (prevClose <= sma200) return null;
  if (fg >= 45) return null;

  const qty = (ctx.cash * 0.98) / ctx.price;
  if (qty <= 0) return null;
  ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'uptrend filter',
               conds: [{ label: 'Fear&Greed', now: fg, op: '<', ref: 45, closed: true }] }]);
  return { side: 'buy', qty };
}
