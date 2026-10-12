/*
 * @coinsori-strategy v1
 * name: SOL Sentiment-Gated Trend 4H
 * ex: binance
 * syms: SOL/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: the Fear & Greed index is the only external data axis that
 *   has worked in this account's backtests, but it has only been tried as a
 *   mean-reversion / sizing input so far. This strategy uses it the other way —
 *   as an ENTRY filter only: buy while the crowd is not euphoric and the trend
 *   is up. No profit-taking on greed — a trend strategy must let winners run.
 * When it buys and sells: buy when Fear&Greed < 55, price is above its 100-EMA
 *   and makes a fresh 20-bar high; sell when price closes below the 20-bar low
 *   or hits a 2.5x ATR hard stop.
 * When it does NOT work: in a melt-up it enters late (after the first euphoric
 *   leg) so it misses part of the move; in a slow grind down with mild fear the
 *   EMA gate keeps it out but it also misses the bottom. It is a defensive trend
 *   rider, not a bull-market champion.
 */
function onUpdate(ctx) {
  const fg = ctx.data('fg');
  const atr = ctx.atr(14, 1);
  const ema100 = ctx.ema(100, 1);
  if (atr == null || ema100 == null) return null;

  const price = ctx.price;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  if (ctx.position > 0) {
    const hardStop = ctx.entryPx - 2.5 * atr;
    const ll20 = ctx.low(20, 2);
    if (price <= hardStop) return { side: 'sell', qty: ctx.position };
    if (ll20 != null && prevClose <= ll20) return { side: 'sell', qty: ctx.position };
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2.5x ATR hard stop' },
               { side: 'sell', price: ll20, trigger: 'below', note: '20-bar channel exit' }]);
    return null;
  }

  if (fg != null && fg >= 55) return null;   // don't chase into euphoria (fg null = data off, skip gate)
  if (prevClose <= ema100) return null;      // only buy in an uptrend
  const hh20 = ctx.high(20, 2);
  if (hh20 == null || prevClose <= hh20) return null;   // enter only on a FRESH breakout

  // risk 2% of cash on a 2.5x ATR stop, capped by available cash
  const riskCash = ctx.cash * 0.02;
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.99) / price;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
