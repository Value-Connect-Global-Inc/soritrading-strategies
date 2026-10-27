/*
 * @coinsori-strategy v1
 * name: BNB EMA50/200 Trend 1D
 * ex: binance
 * syms: BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: a clean price-based trend on BNB, a different asset from
 * the BTC OBV champion. BNB has had strong sustained bull runs (2021, 2024-25)
 * driven by exchange/BSC fundamentals; a slow EMA50/200 crossover rides those
 * trends while a -25% stop caps the deep altcoin drawdowns.
 * When it buys and sells: buys when EMA50 crosses above EMA200 (golden cross,
 * on closed bars); sells when EMA50 crosses below EMA200 (death cross) or on a
 * -25% hard stop from entry.
 * When it does NOT work: EMA crossovers whipsaw in choppy ranges; in a long
 * altcoin bear (2018, 2022) it stays flat and misses the bottom; and it lags
 * sharp parabolic tops by exiting after the trend has already turned.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const pos = ctx.position;

  const e50a = ctx.ema(50, 1);
  const e50b = ctx.ema(50, 2);
  const e200a = ctx.ema(200, 1);
  const e200b = ctx.ema(200, 2);
  if (e50a == null || e50b == null || e200a == null || e200b == null) return null;

  const st = ctx.state;
  let cd = st.cd || 0;
  if (cd > 0) cd--;
  ctx.state.cd = cd;

  if (pos > 0) {
    const entry = ctx.entryPx;
    const stopPx = entry != null ? entry * 0.75 : null;
    const w = [{ side:'sell', note:'death cross', conds:[{label:'EMA50<EMA200', now:e50a, op:'<', ref:e200a, closed:true}]}];
    if (stopPx != null) w.unshift({ side:'sell', price: stopPx, trigger:'below', note:'hard stop -25%' });
    ctx.watch(w);

    // Hard stop first: cap an altcoin knife at -25%.
    if (entry != null && price <= entry * 0.75) {
      ctx.state.cd = 5;
      return { side:'sell', qty:pos, reduceOnly:true };
    }
    // Death cross on closed bars.
    if (e50b > e200b && e50a <= e200a && cd === 0) {
      ctx.state.cd = 5;
      return { side:'sell', qty:pos, reduceOnly:true };
    }
    return null;
  }

  ctx.watch([{ side:'buy', note:'golden cross', conds:[{label:'EMA50>EMA200', now:e50a, op:'>', ref:e200a, closed:true}]}]);

  // Golden cross on closed bars.
  if (e50b <= e200b && e50a > e200a && cd === 0) {
    if (ctx.alloc.status !== 'ok') return null;
    ctx.state.cd = 5;
    return { side:'buy', qty: ctx.cash / price * 0.95 };
  }
  return null;
}
