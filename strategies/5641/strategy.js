/*
 * @coinsori-strategy v1
 * name: BTC Fear-Greed Contrarian 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: sentiment extremes on BTC (the Fear & Greed index) mark
 * short-term capitulation bottoms and euphoria tops. Buying deep fear with a
 * momentum guard and selling into greed is a mean-reversion bet that is
 * independent of the trend-following OBV champion.
 * When it buys and sells: buys when F&G < 20 and price is above its 30-day low
 * (not in free-fall); sells when F&G > 65, or hard stop at -18%.
 * When it does NOT work: in a grinding bear market fear stays low for months
 * and each "capitulation" buy keeps losing; the stop and a long cooldown are
 * the only protection.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const fg = ctx.data("fear_greed");
  if (fg == null) return null; // sentiment data missing -> do nothing

  const pos = ctx.position;
  const st = ctx.state;
  let cd = st.cd || 0;
  if (cd > 0) cd--;
  ctx.state.cd = cd;

  if (pos > 0) {
    const entry = ctx.entryPx;
    const watches = [
      { side: 'sell', price: 65, trigger: 'above', note: 'Greed exit', conds: [{ label: 'F&G', now: fg, op: '>', ref: 65, closed: true }] }
    ];
    if (entry != null && Number.isFinite(entry)) {
      watches.push({ side: 'sell', price: entry * 0.82, trigger: 'below', note: 'Hard stop -18%' });
    }
    ctx.watch(watches);

    if (fg > 65 && cd === 0) {
      ctx.state.cd = 10; // cooldown: don't immediately re-buy after a greed exit
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    if (entry != null && Number.isFinite(entry) && price < entry * 0.82) {
      ctx.state.cd = 20; // longer cooldown after a stop-out
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  const low30 = ctx.low(30, 1);
  if (low30 == null || !Number.isFinite(low30)) return null;

  // momentum guard: price must sit above the 30-day low, else it is a falling knife
  const notFreeFall = price > low30 * 1.02;

  ctx.watch([
    { side: 'buy', price: low30 * 1.02, trigger: 'above', note: 'Extreme-fear entry', conds: [
      { label: 'F&G < 20', now: fg, op: '<', ref: 20, closed: true },
      { label: 'Price > low30*1.02', ok: notFreeFall }
    ]}
  ]);

  if (fg < 20 && notFreeFall && cd === 0) {
    if (ctx.alloc.status !== 'ok') return null;
    // contrarian bets are frequent and can fail -> modest 30% size per entry
    ctx.state.cd = 5;
    return { side: 'buy', qty: ctx.cash / price * 0.30 };
  }
  return null;
}
