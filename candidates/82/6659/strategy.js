/*
 * @coinsori-strategy v1
 * name: SOL 1D Long/Short Regime Filter v2 (lifecycle-safe)
 * ex: binance
 * syms: SOL/USDT
 * interval: 1d
 * cash: 1000
 *
 * Why this strategy: The long-only 50-day regime filter on SOL daily is
 * defensive but sits flat through bear markets. Adding a short leg lets the
 * same slow trend filter earn in falling markets too. The short side is only
 * armed when the 50d MA is below the 100d MA (a genuine bear regime), so deep
 * pullbacks inside a bull market do not trigger short whipsaws.
 * When it buys and sells: long when the close crosses above the 50d MA. A long
 * exits when the close is below the ATR trailing stop AND below the 50d MA; if
 * the 50d MA is below the 100d MA it then re-enters short on the NEXT bar. A
 * short mirrors all of this. Closing and re-entering happen on separate bars so
 * a forced close or restart can never open an unintended position.
 * When it does NOT work: in sideways chop around the 50d MA it whipsaws between
 * long and short and pays fees both ways; a V-shaped reversal right after a flip
 * hits the 3-ATR stop on the new side; perpetual funding every 8 hours drags on
 * any position held through a quiet trend.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const sma50_1 = ctx.sma(50, 1);
  const sma50_2 = ctx.sma(50, 2);
  const sma100_1 = ctx.sma(100, 1);
  if (sma50_1 == null || sma50_2 == null || sma100_1 == null || price == null) return null;

  const close1 = ctx.closes.at(-2);
  const close2 = ctx.closes.at(-3);
  if (close1 == null || close2 == null) return null;

  const atr1 = ctx.atr(14, 1);
  if (atr1 == null || atr1 <= 0) return null;

  const pos = ctx.position;
  // 1x notional: one unit of coin per unit of cash, conservative on a perp.
  const size = (ctx.cash / price) * 0.99;
  // Bear regime: 50d below 100d (death-cross zone). If the 100d is unavailable
  // (early history or a data gap) we sit flat rather than trade without a
  // regime read.
  const bear = sma50_1 < sma100_1;
  // Only open NEW positions when the platform is not managing ours (forced
  // close / returning / demoted). While it is, we only reduce.
  const allocOk = !ctx.alloc || ctx.alloc.status === 'ok';

  if (pos > 0) {
    const highSince = ctx.state.highSince || close1;
    const newHigh = Math.max(highSince, close1);
    ctx.state.highSince = newHigh;
    const stop = newHigh - 3 * atr1;
    const trendBroken = close1 < sma50_1;
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: 'long stop + 50d break', conds: [{ label: 'close < 50d MA', ok: trendBroken }, { label: '50d < 100d (bear)', ok: bear }] }]);
    if (close1 < stop && trendBroken) {
      ctx.state.highSince = 0;
      // Remember the flip but ONLY close this bar. Opening the opposite side in
      // the same tick as a close is unsafe: if the platform force-closes us the
      // second leg would leave an unintended position.
      if (bear) ctx.state.pendingFlip = 'short';
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  if (pos < 0) {
    const lowSince = ctx.state.lowSince || close1;
    const newLow = Math.min(lowSince, close1);
    ctx.state.lowSince = newLow;
    const stop = newLow + 3 * atr1;
    const trendBroken = close1 > sma50_1;
    ctx.watch([{ side: 'buy', price: stop, trigger: 'above', note: 'short stop + 50d break', conds: [{ label: 'close > 50d MA', ok: trendBroken }, { label: '50d > 100d (bull)', ok: !bear }] }]);
    if (close1 > stop && trendBroken) {
      ctx.state.lowSince = 0;
      if (!bear) ctx.state.pendingFlip = 'long';
      return { side: 'buy', qty: -pos, reduceOnly: true };
    }
    return null;
  }

  // Flat.
  const crossUp = close1 > sma50_1 && close2 <= sma50_2;
  const crossDown = close1 < sma50_1 && close2 >= sma50_2;
  const watchArr = [
    { side: 'buy', price: sma50_1, trigger: 'above', note: 'long on 50d cross' },
    { side: 'sell', price: sma50_1, trigger: 'below', note: 'short on 50d cross (bear only)', conds: [{ label: '50d < 100d (bear)', ok: bear }] }
  ];
  // Declare a pending flip re-entry so the fill is matched to a declaration.
  if (ctx.state.pendingFlip === 'short') {
    watchArr.push({ side: 'sell', price: price, trigger: 'below', note: 'flip to short', conds: [{ label: '50d < 100d (bear)', ok: bear }, { label: 'alloc ok', ok: allocOk }] });
  } else if (ctx.state.pendingFlip === 'long') {
    watchArr.push({ side: 'buy', price: price, trigger: 'above', note: 'flip to long', conds: [{ label: '50d > 100d (bull)', ok: !bear }, { label: 'alloc ok', ok: allocOk }] });
  }
  ctx.watch(watchArr);

  // A pending flip only fires if the regime still holds AND the platform allows
  // new entries (a forced close or demotion clears it, going flat instead).
  if (ctx.state.pendingFlip === 'short' && bear && allocOk) {
    ctx.state.pendingFlip = null;
    ctx.state.lowSince = close1;
    return { side: 'sell', qty: size };
  }
  if (ctx.state.pendingFlip === 'long' && !bear && allocOk) {
    ctx.state.pendingFlip = null;
    ctx.state.highSince = close1;
    return { side: 'buy', qty: size };
  }
  ctx.state.pendingFlip = null;

  if (allocOk) {
    if (crossUp) {
      ctx.state.highSince = close1;
      return { side: 'buy', qty: size };
    }
    if (crossDown && bear) {
      ctx.state.lowSince = close1;
      return { side: 'sell', qty: size };
    }
  }
  return null;
}
