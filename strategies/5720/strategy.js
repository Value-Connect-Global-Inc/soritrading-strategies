/*
 * @coinsori-strategy v1
 * name: BTC Dip-Buy Mean Reversion + Network Health 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: When Bitcoin gets oversold (RSI very low) but the network is still growing (active addresses above their 30-day average), the dip is a buying opportunity, not a death spiral. This is mean reversion, the opposite family from trend-following.
 * When it buys and sells: Buys when RSI(14) is oversold (below 30) AND active addresses are expanding. Sells when RSI recovers above 55 (the dip has reversed) or when network usage turns unhealthy.
 * When it does NOT work: In a sustained bear market where every oversold bounce keeps failing (e.g. 2018, 2022), it will buy dips that keep going down. The on-chain filter helps but cannot fully prevent catching falling knives.
 */
function onUpdate(ctx) {
  const rsi = ctx.rsi(14, 1); // closed-bar RSI — same value in backtest/live
  const addr = ctx.data("addr"); // daily unique active addresses
  const addrSma = ctx.data("addr_sma30"); // 30-day average of addresses
  if (rsi == null || addr == null || addrSma == null) return null;

  const price = ctx.price;
  // network healthy = current usage above its own 30-day average (expanding, not dying)
  const networkHealthy = addr > addrSma;

  if (ctx.position > 0) {
    // exit when the dip has fully reversed (RSI back to 55) or network turns unhealthy
    if (rsi > 55 || !networkHealthy) {
      return { side: 'sell', qty: ctx.position, reduceOnly: true };
    }
    return null; // still in the dip recovery — hold
  }

  // entry: oversold + healthy network = bounce worth buying
  if (rsi < 30 && networkHealthy && ctx.cash > 0) {
    return { side: 'buy', qty: ctx.cash / price * 0.99 };
  }
  return null;
}
