/*
 * @coinsori-strategy v1
 * name: SOL 1D Asymmetric Regime Filter (dual-exit)
 * ex: binance
 * syms: SOL/USDT
 * interval: 1d
 * cash: 1000
 *
 * Why this strategy: The asymmetric regime filter validated on XRP daily,
 * applied to volatile alts. A fixed 20-day exit whipsaws a volatile alt's
 * normal bull pullbacks, so the exit is volatility-scaled: highest close since
 * entry minus 3 ATR(14) (~15-18% of price). But a deep bull pullback can still
 * trip that stop, so the exit now requires BOTH the ATR stop AND the close
 * below the 50-day average — a normal correction stays above a rising 50d MA,
 * a real crash breaks both. Entry stays the slow 50-day cross (few whipsaws).
 * When it buys and sells: buys when the daily close crosses back above the
 * 50-day average; sells only when the close is below the ATR trailing stop AND
 * below the 50-day average.
 * When it does NOT work: in sideways chop around the 50-day average it flips
 * on and off and pays fees; in a slow grinding bear the 50d falls slowly, so
 * the dual exit can hold too long and give back more than a plain stop; in a
 * violent fast crash ATR spikes and the trailing stop widens, so the exit lags.
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
    // Dual exit: only leave when the stop AND the 50d trend are broken, so a
    // deep pullback that stays above a rising 50d MA does not kick us out.
    const trendBroken = close1 < sma50_1;
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: 'ATR stop + 50d break', conds: [{ label: 'close < 50d MA', ok: trendBroken }] }]);
    if (close1 < stop && trendBroken) {
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
