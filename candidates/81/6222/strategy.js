/*
 * @coinsori-strategy v1
 * name: BTC 50d/20d Regime Trail 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: trend following with an asymmetric speed — slow to enter, fast to exit.
 * The 50d MA confirms the bull regime before buying (5% band avoids small whipsaws), but exits
 * on the fast 20d MA so a crash is cut within days instead of riding it all the way down to the
 * slow MA. A 30% trailing stop is a backstop for gaps through the fast MA.
 * When it buys and sells: buys when price rises 5% above the 50d MA; sells when price closes
 * below the 20d MA OR drops 30% from the highest price since entry.
 * When it does NOT work: a choppy sideways market whipsaws across the fast MA and pays fees
 * both ways. It also misses the first leg of a sharp V-reversal because the 50d MA entry is slow.
 */
function onUpdate(ctx) {
  const REGIME_N = 300;  // 50 days at 4h — slow entry filter, confirms the bull regime
  const EXIT_N = 120;    // 20 days at 4h — fast exit filter, cuts crashes within days (drawdown reducer)
  const BAND = 0.05;     // hysteresis: buy 5% above the 50d MA to skip small crossings
  const TRAIL = 0.30;    // backstop: exit if price falls 30% from the high since entry

  const ma = ctx.sma(REGIME_N, 1);  // closed-bar values (ago=1), identical in live and backtest
  const ema = ctx.sma(EXIT_N, 1);
  if (ma == null || ema == null) { ctx.watch([]); return null; }

  const price = ctx.price;
  const upBand = ma * (1 + BAND);
  const st = ctx.state;

  if (ctx.position > 0) {
    // track the highest price since entry for the trailing stop
    if (st.hi == null || price > st.hi) st.hi = price;
    const stopPx = st.hi * (1 - TRAIL);
    const exitPx = Math.min(ema, stopPx);
    if (price < ema || price < stopPx) {
      ctx.watch([{ side: 'sell', price: exitPx, trigger: 'below', note: 'fast MA or trail stop' }]);
      return { side: 'sell', qty: ctx.position, reduceOnly: true };
    }
    ctx.watch([{ side: 'sell', price: exitPx, trigger: 'below', note: 'fast MA or trail stop' }]);
    return null;
  }

  // enter only when price rises 5% above the 50d MA (slow confirmation)
  if (price > upBand) {
    st.hi = price;
    ctx.watch([{ side: 'buy', price: upBand, trigger: 'above', note: 'above 50d MA band' }]);
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.98 };
  }
  ctx.watch([{ side: 'buy', price: upBand, trigger: 'above', note: 'above 50d MA band' }]);
  return null;
}
