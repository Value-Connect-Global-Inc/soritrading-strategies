/*
 * @coinsori-strategy v1
 * name: Stoch Turn-Confirm ETH 1D
 * ex: binance
 * syms: ETH/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: instead of buying an oversold dip while it is still falling
 * (RSI2 just failed at that), it waits for the stochastic to CONFIRM the turn —
 * %K crossing back above %D from the oversold zone means the bounce has started.
 * Gating by the 200-day average keeps it on the right side of the long-term trend.
 * When it buys and sells: buy when the 14-period stochastic %K crosses above %D
 * from below 20 while price is above SMA200. Sell when %K crosses below %D from
 * above 80, or the -15% hard stop hits.
 * When it does NOT work: in a bear market the 200-day gate keeps it flat (no
 * downside but no upside either); a strong straight-line melt-up never gives an
 * oversold turn so it misses the whole move; sideways chop whipsaws the cross.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const st1 = ctx.stoch(14, 3, 1);  // closed-bar stochastic
  const st2 = ctx.stoch(14, 3, 2);  // previous closed bar, for the cross
  const sma200 = ctx.sma(200, 1);
  if (st1 == null || st2 == null || sma200 == null) return null;
  const k1 = st1.k, d1 = st1.d, k2 = st2.k, d2 = st2.d;
  if (!Number.isFinite(k1) || !Number.isFinite(d1) || !Number.isFinite(k2) || !Number.isFinite(d2)) return null;

  const pos = ctx.position;
  if (pos > 0) {
    const stop = ctx.entryPx == null ? null : ctx.entryPx * 0.85;
    const crossDown = k1 > 80 && d1 > 80 && k2 >= d2 && k1 < d1; // %K falls below %D from overbought
    ctx.watch([{ side:'sell', price: stop, trigger:'below', note:'hard stop -15%' },
               { side:'sell', price: null, trigger:'above', note:'stoch overbought cross down',
                 conds:[{ label:'%K overbought', ok: k1 > 80, closed:true },
                        { label:'overbought cross', ok: crossDown, closed:true }] }]);
    if (price <= stop || crossDown) return { side: 'sell', qty: pos };
    return null;
  }

  // entry: %K crosses above %D from oversold (<20), inside uptrend
  const crossUp = k2 < 20 && d2 < 20 && k2 <= d2 && k1 > d1;
  const uptrend = price > sma200;
  ctx.watch([{ side:'buy', price: null, trigger:'above', note:'stoch oversold cross up',
               conds:[{ label:'%K oversold', ok: k1 < 20, closed:true },
                      { label:'%K>%D cross', ok: crossUp, closed:true },
                      { label:'200d uptrend', ok: uptrend, closed:true }] }]);
  if (!uptrend || !crossUp) return null;

  const qty = (ctx.cash * 0.95) / price;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
