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
 * When it buys and sells: buys when F&G < 20, price is above SMA200 (long-term
 * uptrend) and above its 30-day low; sells when F&G > 65, or hard stop -18%.
 * When it does NOT work: in a grinding bear market the SMA200 filter keeps it
 * flat (good), but it also misses the strongest rebound off a true bear-market
 * bottom because that bottom sits below SMA200.
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
      ctx.state.cd = 10;
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    if (entry != null && Number.isFinite(entry) && price < entry * 0.82) {
      ctx.state.cd = 20;
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  const sma200 = ctx.sma(200, 1);
  if (sma200 == null || !Number.isFinite(sma200)) return null;
  const low30 = ctx.low(30, 1);
  if (low30 == null || !Number.isFinite(low30)) return null;

  const uptrend = price > sma200;
  const notFreeFall = price > low30 * 1.02;

  ctx.watch([
    { side: 'buy', price: low30 * 1.02, trigger: 'above', note: 'Extreme-fear entry', conds: [
      { label: 'F&G < 20', now: fg, op: '<', ref: 20, closed: true },
      { label: 'Price > SMA200', ok: uptrend },
      { label: 'Price > low30*1.02', ok: notFreeFall }
    ]}
  ]);

  if (fg < 20 && uptrend && notFreeFall && cd === 0) {
    if (ctx.alloc.status !== 'ok') return null;
    ctx.state.cd = 5;
    return { side: 'buy', qty: ctx.cash / price * 0.30 };
  }
  return null;
}
