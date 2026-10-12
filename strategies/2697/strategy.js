/*
 * @coinsori-strategy v1
 * name: Band-Bounce Bull-Regime Exit LINK 4H
 * ex: binance
 * syms: LINKUSDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: The validated band-bounce mean-reversion champion's one
 * documented weakness is lagging strong melt-ups (it sells at the middle band
 * quickly and never re-enters). This variant lets winners run ONLY when the
 * 200-SMA slope is strongly positive (confirmed bull), exiting at the upper
 * band instead of the middle band. It adds no extra entries, so the rare-panic
 * trade-rarity edge stays intact.
 * When it buys and sells: same champion buy (close below lower Bollinger(20,2)
 * with RSI<30 while above the 200-SMA). Sells at the middle band / RSI>50 by
 * default, but holds to the UPPER band when the 200-SMA is rising steeply.
 * When it does NOT work: in a bull that reverses before reaching the upper band
 * it gives back more than the plain champion; below the 200-SMA it never buys.
 *
 * 2025-01-01: display-only watch declarations added; trade logic unchanged.
 */
function onUpdate(ctx) {
  const bb = ctx.bb(20, 2, 1);
  const rsi = ctx.rsi(14, 1);
  const sma200 = ctx.sma(200, 1);
  const sma200p = ctx.sma(200, 2);
  if (bb == null || rsi == null || sma200 == null || sma200p == null) {
    ctx.watch([]);
    return null;
  }

  const price = ctx.price;
  const pos = ctx.position;

  const bullRegime = sma200 > sma200p * 1.0015;

  if (pos > 0) {
    const atr = ctx.atr(14, 1);
    const stopPx = atr != null ? ctx.entryPx - atr * 6 : null;
    const watchEntries = [];
    if (bullRegime) {
      watchEntries.push({ side: 'sell', price: bb.upper, trigger: 'above', note: 'bull upper band', conds: [
        { label: 'RSI(14) close', now: rsi, op: '<', ref: 70, closed: true }
      ] });
      watchEntries.push({ side: 'sell', price: null, trigger: 'above', note: 'RSI overbought', conds: [
        { label: 'RSI(14) close', now: rsi, op: '>=', ref: 70, closed: true }
      ] });
      if (stopPx != null) {
        watchEntries.push({ side: 'sell', price: stopPx, trigger: 'below', note: 'ATR stop' });
      }
    } else {
      watchEntries.push({ side: 'sell', price: bb.mid, trigger: 'above', note: 'mid band', conds: [
        { label: 'RSI(14) close', now: rsi, op: '<', ref: 50, closed: true }
      ] });
      watchEntries.push({ side: 'sell', price: null, trigger: 'above', note: 'RSI exit', conds: [
        { label: 'RSI(14) close', now: rsi, op: '>=', ref: 50, closed: true }
      ] });
      if (stopPx != null) {
        watchEntries.push({ side: 'sell', price: stopPx, trigger: 'below', note: 'ATR stop' });
      }
    }
    ctx.watch(watchEntries);

    if (bullRegime) {
      if (price >= bb.upper || rsi > 70) {
        ctx.state.lastExit = ctx.i;
        return { side: 'sell', qty: pos };
      }
    } else if (price >= bb.mid || rsi > 50) {
      ctx.state.lastExit = ctx.i;
      return { side: 'sell', qty: pos };
    }
    if (atr != null && price <= ctx.entryPx - atr * 6) {
      ctx.state.lastExit = ctx.i;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  const lastExit = ctx.state.lastExit || 0;
  if (ctx.i - lastExit < 5) {
    ctx.watch([]);
    return null;
  }

  if (price < sma200) {
    ctx.watch([]);
    return null;
  }

  if (price < bb.lower && rsi < 30) {
    ctx.watch([{ side: 'buy', price: bb.lower, trigger: 'below', note: 'BB lower + RSI<30', conds: [
      { label: 'RSI(14) close', now: rsi, op: '<', ref: 30, closed: true },
      { label: 'Price < SMA200', ok: price < sma200 }
    ] }]);
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.95 };
  }

  ctx.watch([{ side: 'buy', price: bb.lower, trigger: 'below', note: 'BB lower', conds: [
    { label: 'RSI(14) close', now: rsi, op: '<', ref: 30, closed: true },
    { label: 'Price < SMA200', ok: price < sma200 }
  ] }]);
  return null;
}
