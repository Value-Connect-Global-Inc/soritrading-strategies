/*
 * @coinsori-strategy v1
 * name: SOL Dip-in-Uptrend 4H
 * ex: binance
 * syms: SOL/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: the champion (3609) only enters on fresh 20-bar breakouts,
 *   which buys late and misses the early part of a move. This variant enters
 *   EARLIER — on a pullback inside an established uptrend — and then rides the
 *   recovery with the same channel exit, so it should catch more of each move.
 * When it buys and sells: buy when price is above its 100-EMA, RSI(14) is below
 *   40 (a dip, not a crash) and Fear&Greed is below 75; sell on a 20-bar low
 *   close or a 2.5x ATR hard stop.
 * When it does NOT work: in a choppy market pullback entries are stopped out
 *   more often than breakout entries; in a slow grind down the EMA gate keeps it
 *   out but it also misses the bottom. It can also buy a dip that keeps dipping.
 */
function onUpdate(ctx) {
  const st = ctx.state || {};
  const fg = ctx.data('fg');
  const atr = ctx.atr(14, 1);
  const ema100 = ctx.ema(100, 1);
  const rsi = ctx.rsi(14, 1);
  if (atr == null || ema100 == null || rsi == null) return null;

  const price = ctx.price;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  if (ctx.position > 0) {
    const hardStop = ctx.entryPx - 2.5 * atr;
    const ll20 = ctx.low(20, 2);
    if (price <= hardStop) { st.lastExit = ctx.i; return { side: 'sell', qty: ctx.position }; }
    if (ll20 != null && prevClose <= ll20) { st.lastExit = ctx.i; return { side: 'sell', qty: ctx.position }; }
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2.5x ATR hard stop' },
               { side: 'sell', price: ll20, trigger: 'below', note: '20-bar channel exit' }]);
    return null;
  }

  if (fg != null && fg >= 75) return null;   // only a blow-off top blocks entry (fg null = data off, skip gate)
  if (prevClose <= ema100) return null;      // only buy in an uptrend
  if (rsi >= 40) return null;                // wait for a dip, not a breakout
  if (st.lastExit != null && ctx.i - st.lastExit < 5) return null;  // short cooldown after a stop-out

  // risk 2% of cash on a 2.5x ATR stop, capped by available cash
  const riskCash = ctx.cash * 0.02;
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.99) / price;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
