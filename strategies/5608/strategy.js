/*
 * @coinsori-strategy v1
 * name: BTC Fear&Greed Contrarian 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: retail sentiment is a contrarian signal. When the Fear &
 * Greed index hits extreme fear (<20) the crowd is capitulating — historically
 * a good entry. When it reaches greed (>70) the crowd is euphoric — a good exit.
 * This is a different signal family (sentiment) from price/volume trend-following.
 * When it buys and sells: buys when the Fear & Greed index closes below 20
 * (capitulation); sells when it recovers above 70, or after 90 days, or on a
 * -25% hard stop from entry.
 * When it does NOT work: in a prolonged bear market fear stays low for months,
 * so it buys capitulation early and the -25% stop fires repeatedly; in a slow
 * grind it never sees extreme fear and stays flat.
 */
function onUpdate(ctx) {
  const pos = ctx.position;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const fg = ctx.data("fear_greed");
  if (fg == null) return null; // sentiment data missing -> stay flat

  const st = ctx.state;
  let hold = st.hold || 0;
  let cd = st.cd || 0;
  if (cd > 0) cd--;
  ctx.state.cd = cd;

  if (pos > 0) {
    hold++;
    const entry = ctx.entryPx;
    const stopPx = entry != null ? entry * 0.75 : null; // hard -25% stop on every position
    const greed = fg > 70; // crowd euphoric -> take profit
    const timeUp = hold >= 90; // cap dead positions: fear can stay low for months
    const w = [];
    if (stopPx != null) w.push({ side: 'sell', price: stopPx, trigger: 'below', note: '-25% stop' });
    w.push({ side: 'sell', price: price, trigger: 'above', note: 'Greed>70 exit', conds: [{ label: 'F&G', now: fg, op: '>', ref: 70 }] });
    ctx.watch(w);
    if (greed || timeUp || (stopPx != null && price <= stopPx)) {
      ctx.state.cd = 5;
      ctx.state.hold = 0;
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    ctx.state.hold = hold;
    return null;
  }

  const extremeFear = fg < 20; // capitulation: sentiment at panic lows
  ctx.watch([{ side: 'buy', price: price, trigger: 'below', note: 'Extreme fear entry', conds: [{ label: 'F&G < 20', now: fg, op: '<', ref: 20 }] }]);
  if (extremeFear && cd === 0) {
    if (ctx.alloc.status !== 'ok') return null;
    ctx.state.cd = 5;
    ctx.state.hold = 0;
    return { side: 'buy', qty: ctx.cash / price * 0.95 };
  }
  return null;
}
