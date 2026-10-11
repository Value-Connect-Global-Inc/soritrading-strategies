/*
 * @coinsori-strategy v1
 * name: ETH Funding Squeeze Contrarian 4H
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Negative funding means the crowd is short while the long-term
 *   trend is still up — those shorts become squeeze fuel. This is real derivatives
 *   flow (who is paying whom), not a survey index. Bet: short positioning inside
 *   an established uptrend reverts upward.
 * When it buys and sells: buys when funding is negative (below -0.01%) AND price is
 *   above the 200 SMA (long-term uptrend intact), with a modest position so a failed
 *   squeeze cannot hurt much. Sells when funding turns positive again (squeeze done),
 *   on a 2x ATR hard stop, or if price loses the 200 SMA.
 * When it does NOT work: in genuine bear markets or long chop below the 200 SMA it
 *   stays flat, but sideways markets with negative funding can whipsaw small entries;
 *   a funding signal is a counter-move, not a trend ride.
 */
function onUpdate(ctx) {
  const funding = ctx.funding;               // current funding rate (fraction, e.g. -0.0001)
  const sma200 = ctx.sma(200, 1);
  const atr = ctx.atr(14, 1);
  if (funding == null || sma200 == null || atr == null) return null;
  const price = ctx.price;

  if (ctx.position > 0) {
    // exit: squeeze done (funding back to >=0), hard stop, or long-term trend broken
    if (funding >= 0) return { side: 'sell', qty: ctx.position };
    const hardStop = ctx.entryPx - 2 * atr;
    if (price <= hardStop) return { side: 'sell', qty: ctx.position };
    if (price <= sma200) return { side: 'sell', qty: ctx.position };
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2x ATR stop' },
               { side: 'sell', price: sma200, trigger: 'below', note: '200 SMA trend broken' }]);
    return null;
  }

  // entry: negative funding = shorts paying; only enter when the 200 SMA trend is up
  if (funding >= -0.0001) return null;   // -0.01%: meaningfully negative, not extreme-rare
  if (price <= sma200) return null;

  const qty = (ctx.cash * 0.30) / price;  // modest size: a squeeze is a counter-move, not a trend ride
  if (qty <= 0) return null;
  ctx.watch([{ side: 'buy', conds: [{ label: 'funding', now: funding, op: '<', ref: -0.0001, closed: true },
                                    { label: 'price > SMA200', ok: price > sma200 }] }]);
  return { side: 'buy', qty };
}
