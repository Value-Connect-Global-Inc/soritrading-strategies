/*
 * @coinsori-strategy v1
 * name: SOL Sentiment-Gated Trend 4H (trail exit)
 * ex: binance
 * syms: SOL/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: the Fear & Greed index is the only external data axis that
 *   has worked in this account's backtests, but it has only been tried as a
 *   mean-reversion / sizing input so far. This strategy uses it as an ENTRY
 *   filter: buy while the crowd is not in a blow-off top and the trend is up.
 *   No profit-taking on greed — a trend strategy must let winners run.
 * When it buys and sells: buy when Fear&Greed < 75, price above its 100-EMA and
 *   making a fresh 20-bar high; sell when price hits a ratcheting stop (highest
 *   recent high minus 2.5x ATR, never lower than the entry-based stop) or closes
 *   below the 20-bar low. The ratchet locks in gains as the trade moves up.
 * When it does NOT work: in a melt-up it enters late and misses part of the move;
 *   in a slow grind down with mild fear the EMA gate keeps it out but it also
 *   misses the bottom. Defensive trend rider, not a bull champion.
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
    // ratcheting stop: recent 20-bar high minus 2.5x ATR, never below entry-based stop
    const baseStop = ctx.entryPx - 2.5 * atr;
    const recentHigh = ctx.high(20, 1);
    let stop = baseStop;
    if (recentHigh != null) {
      const trailStop = recentHigh - 2.5 * atr;
      if (trailStop > stop) stop = trailStop;  // ratchet up only
    }
    const ll20 = ctx.low(20, 2);
    if (price <= stop) return { side: 'sell', qty: ctx.position };
    if (ll20 != null && prevClose <= ll20) return { side: 'sell', qty: ctx.position };
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: 'trailing stop' },
               { side: 'sell', price: ll20, trigger: 'below', note: '20-bar channel exit' }]);
    return null;
  }

  if (fg != null && fg >= 75) return null;   // only a blow-off top blocks entry (fg null = data off, skip gate)
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
