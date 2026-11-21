/*
 * @coinsori-strategy v1
 * name: SOL 1D Asymmetric Regime Filter (ATR exit)
 * ex: binance
 * syms: SOL/USDT
 * interval: 1d
 * cash: 1000
 *
 * Why this strategy: The asymmetric regime filter validated on XRP daily
 * applied to volatile alts. A fixed 20-day exit whipsaws a volatile alt's
 * normal bull pullbacks, so the exit is instead a volatility-scaled trailing
 * stop (highest close since entry minus 3 ATR(14), ~15-18% of price): it
 * survives routine 20-30% bull corrections and still cuts a real crash.
 * Entry is the slow 50-day cross (few whipsaws).
 * When it buys and sells: buys when the daily close crosses back above the
 * 50-day average; sells when the close falls 3 ATR(14) below the highest
 * close since entry.
 * When it does NOT work: in a sideways chop around the 50-day average it flips
 * on and off and pays fees; in a strong bull with a deep mid-trend correction
 * (like 2024's -40% pullback) the stop exits and it re-enters late, so it can
 * end flat while buy-and-hold keeps the whole rise; in a fast crash ATR spikes
 * and the trailing stop widens, so the exit lags a violent collapse.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const sma50_1 = ctx.sma(50, 1);
  const sma50_2 = ctx.sma(50, 2);
  if (sma50_1 == null || sma50_2 == null || price == null) return null;

  const close1 = ctx.closes.at(-2);
  const close2 = ctx.closes.at(-3);
  if (close1 == null || close2 == null) return null;

  if (ctx.position > 0) {
    const atr1 = ctx.atr(14, 1);
    if (atr1 == null || atr1 <= 0) return null;
    // Trailing high since entry, kept in state so it survives a restart.
    const highSince = ctx.state.highSince || close1;
    const newHigh = Math.max(highSince, close1);
    ctx.state.highSince = newHigh;
    // 3 ATR: roughly 15-18% of price on SOL daily — wide enough to survive
    // normal bull pullbacks, tight enough to cut a real crash.
    const stop = newHigh - 3 * atr1;
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: 'ATR trailing stop' }]);
    if (close1 < stop) {
      ctx.state.highSince = 0;
      return { side: 'sell', qty: ctx.position, reduceOnly: true };
    }
    return null;
  }

  ctx.watch([{ side: 'buy', price: sma50_1, trigger: 'above', note: 'back above 50d MA' }]);
  if (close1 > sma50_1 && close2 <= sma50_2) {
    ctx.state.highSince = close1;
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  return null;
}
