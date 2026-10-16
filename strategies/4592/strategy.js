/*
 * @coinsori-strategy v1
 * name: Fear-Dip Contrarian Basket (buy panic, sell greed)
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: the Crypto Fear & Greed Index is a crowd-sentiment gauge.
 * The champion rides confirmed greed (buy >= 55, sell <= 40). This is the
 * mirror thesis: extreme fear (index <= 20) marks capitulation, and inside a
 * market that is still above its 200-day average, capitulation is a buying
 * opportunity because the long-term trend is intact. It catches the start of
 * a bull run that the champion misses because the champion waits for greed.
 * When it buys and sells: on each asset, buy when F&G <= 20 AND price is above
 * its 200-day average. Sell when F&G recovers to >= 55 or price drops 25%
 * below entry (hard stop).
 * When it does NOT work: in a long bear market the 200-day filter blocks most
 * entries, but a bear-trap rally can still trigger a buy that then hits the
 * 25% stop — repeated whipsaw is possible. Extreme fear can also persist while
 * price grinds lower, so the stop does the real work. It does no trades in a
 * calm uptrend, missing slow steady gains.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  // ctx.data returns strings — coerce to number. Same dataset the champion uses.
  const fg = Number(ctx.data('fg'));
  if (!Number.isFinite(fg)) return null;

  const pos = ctx.position;
  if (pos > 0) {
    const entry = ctx.entryPx;
    if (entry != null) {
      // 25% hard stop: a dip-buy gone wrong (bear trap) must not bleed.
      if (price <= entry * 0.75) return { side: 'sell', qty: pos };
      ctx.watch([{ side: 'sell', price: entry * 0.75, trigger: 'below', note: 'stop: -25%' }]);
    }
    // Greed returned — the panic is over, take the recovery profit.
    if (fg >= 55) return { side: 'sell', qty: pos };
    return null;
  }

  // Trend filter: only buy the dip when the long-term uptrend is intact
  // (closed bar). In a bear market extreme fear is the start of more pain,
  // not a bottom — this filter keeps us out.
  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;

  // Extreme fear = capitulation. Threshold 20 mirrors the champion's 55 greed
  // entry symmetric. Buy the panic while the trend is intact.
  if (fg <= 20 && price > sma200) {
    return { side: 'buy', qty: (ctx.cash / price) * 0.95 };
  }

  // Declare what we are waiting for so the run card shows it.
  ctx.watch([{
    side: 'buy',
    price: fg <= 20 ? sma200 : price,
    trigger: 'above',
    note: 'enter: fear<=20 & trend up',
    conds: [{ label: 'F&G index', now: fg, op: '<=', ref: 20, closed: true }]
  }]);
  return null;
}
