/*
 * @coinsori-strategy v1
 * name: Multi-Asset Donchian Basket 5-Leg 1D
 * ex: binance
 * syms: BTCUSDT, ETHUSDT, SOLUSDT, ADAUSDT, XRPUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The 4-leg basket cut drawdown to roughly half of any single
 * coin. Adding a fifth leg (XRP) extends the diversification thesis with a coin
 * that has longer history than DOGE, testing whether more legs genuinely smooth
 * the equity curve without adding fee drag.
 * When it buys and sells: on each coin, buy when a closed bar closes above its
 * 55-day high (half size below the 200-day average). Sells when a closed bar
 * closes below the 10-day low or price falls 2.5 ATR below entry. After a
 * stop-out the coin pauses 10 bars.
 * When it does NOT work: In a broad coordinated crypto bear all five trend gates
 * stay flat (capital safe, little upside). In a crash that hits all coins at
 * once the basket drawdown is close to a single coin's.
 */
function onUpdate(ctx) {
  const sym = ctx.sym;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const closes = ctx.closes;
  const n = closes.length;
  if (n < 60) return null;
  const prevClose = closes.at(-2);
  if (prevClose == null) return null;

  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0) return null;

  const sma200 = ctx.sma(200, 1);
  let sizeMult = 0.2;                  // per-leg share of equity (5 coins)
  if (sma200 != null && prevClose < sma200) sizeMult = 0.1;   // bear: half the leg share

  if (!ctx.state.cool || typeof ctx.state.cool !== 'object') ctx.state.cool = {};   // per-symbol cooldown

  const pos = ctx.pos(sym);
  if (pos > 0) {
    const entry = ctx.entryPx || price;
    const channelLow = Math.min(...closes.slice(-12, -2));
    const stop = entry - 2.5 * atr;
    ctx.watch([{ side: 'sell', price: channelLow, trigger: 'below', note: '10-day low trail' },
               { side: 'sell', price: stop, trigger: 'below', note: '2.5 ATR stop' }]);
    if (prevClose < channelLow || price < stop) {
      ctx.state.cool[sym] = ctx.i + 10;   // pause this coin after a stop-out
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  const channelHigh = Math.max(...closes.slice(-57, -2));
  const breakout = prevClose > channelHigh;
  if (breakout && ctx.i >= (ctx.state.cool[sym] || 0)) {
    ctx.state.cool[sym] = 0;
    ctx.watch([{ side: 'sell', price: price - 2.5 * atr, trigger: 'below', note: '2.5 ATR stop' }]);
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 * sizeMult };
  }
  return null;
}
