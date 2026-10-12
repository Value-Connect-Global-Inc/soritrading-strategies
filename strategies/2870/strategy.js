/*
 * @coinsori-strategy v1
 * name: BB Squeeze Breakout 1D
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * 2026-04-26: 표시만 바뀜, 매매 판단은 그대로
 *
 * Why this strategy: A different family from the validated mean-reversion and
 * volume-flow champions. It bets on volatility contraction followed by
 * expansion: after the Bollinger bands squeeze to their narrowest in months,
 * a break above the upper band often starts a strong directional move.
 * When it buys and sells: buys when the 20-bar Bollinger band width is at its
 * lowest in 90 bars (a squeeze) and price closes above the upper band. Exits
 * when price closes back below the middle band, or on a wide trailing stop.
 * When it does NOT work: in a sideways market the band stays squeezed and
 * every breakout is a false one (it buys and immediately reverses); and in a
 * slow grind the squeeze never triggers so it sits in cash during a melt-up.
 */
function onUpdate(ctx) {
  const pos = ctx.position;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) {
    ctx.watch([]);
    return null;
  }

  const bb = ctx.bb(20, 2, 1);
  const atr = ctx.atr(14, 1);
  if (bb == null || atr == null || atr <= 0) {
    ctx.watch([]);
    return null;
  }

  const width = (bb.upper - bb.lower) / bb.mid;
  const st = ctx.state;

  // Exit: price back under the middle band, or trailing stop of 5x ATR.
  if (pos > 0) {
    const peak = Math.max(st.peak || ctx.entryPx || price, price);
    st.peak = peak;
    if (price < bb.mid || price <= peak - 5 * atr) {
      st.peak = null;
      ctx.watch([]);
      return { side: 'sell', qty: pos };
    }
    ctx.watch([
      { side: 'sell', price: bb.mid, trigger: 'below', note: 'close below mid band' },
      { side: 'sell', price: peak - 5 * atr, trigger: 'below', note: 'trailing stop 5*ATR' }
    ]);
    return null;
  }

  // Squeeze: current band width is the narrowest of the last 90 bars.
  const N = 90;
  if (ctx.i < N) {
    ctx.watch([]);
    return null;
  }
  let minW = Infinity;
  for (let k = 1; k <= N; k++) {
    const b = ctx.bb(20, 2, k);
    if (b == null || b.mid <= 0) continue;
    const w = (b.upper - b.lower) / b.mid;
    if (w < minW) minW = w;
  }
  // Need a real squeeze: current width at least 20% below the 90-bar min is
  // impossible, so instead require current width near the minimum (a genuine
  // contraction) before the breakout.
  const squeezed = width <= minW * 1.05 && width < 0.15;

  if (squeezed && price > bb.upper) {
    st.peak = price;
    ctx.watch([]);
    return { side: 'buy', qty: ctx.cash / price * 0.9 };
  }
  ctx.watch([
    { side: 'buy', price: bb.upper, trigger: 'above', note: 'BB upper breakout', conds: [{ label: 'Squeeze', ok: squeezed }] }
  ]);
  return null;
}
