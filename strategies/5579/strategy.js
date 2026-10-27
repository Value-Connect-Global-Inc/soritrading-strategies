/*
 * @coinsori-strategy v1
 * name: BTC FearGreed Contrarian 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The Fear & Greed index is a crowd-sentiment gauge. Historically
 * extreme fear (everyone has sold) marks good long entries and extreme greed marks
 * good exits. This is a sentiment-contrarian family, different from the price-only
 * trend follower already validated.
 * When it buys and sells: Buys when the index closes below 25 (extreme fear) while
 * price is still above the 200d average (long-term uptrend intact). Sells when the
 * index rises above 70 (extreme greed), price closes 3xATR below the highest close
 * since entry, or the trend breaks below the 200d average.
 * When it does NOT work: In a genuine bear market the index stays in extreme-fear
 * territory for months while price keeps falling — the 200d filter limits but does
 * not remove this. Also a long calm period keeps the index in the 30-70 band and
 * the strategy sits in cash, missing a steady bull.
 */
function onUpdate(ctx) {
  const closes = ctx.closes;
  if (closes == null || closes.length < 210) return null;
  const price = ctx.price;
  if (price == null || price <= 0) return null;

  const sma200 = ctx.sma(200, 1);
  const atr = ctx.atr(14, 1);
  const fg = ctx.data("fear_greed"); // sentiment gauge, null until first value
  if (sma200 == null || atr == null || atr <= 0 || fg == null) return null;

  const prevClose = closes.at(-2);
  const pos = ctx.position;

  // --- EXIT logic while holding ---
  if (pos != null && pos > 0) {
    let st = ctx.state || {};
    if (typeof st.hi !== 'number') st.hi = prevClose;
    if (prevClose > st.hi) st.hi = prevClose;
    ctx.state = st;
    const trailStop = st.hi - 3 * atr; // trailing stop: 3xATR below the highest close since entry
    const trendBroken = prevClose < sma200; // trend filter: exit if the long-term uptrend breaks
    if (fg >= 70 || prevClose < trailStop || trendBroken) {
      ctx.watch([{ side: 'sell', price: trailStop, trigger: 'below', note: 'trail 3xATR' },
                 { side: 'sell', price: 70, trigger: 'above', note: 'F&G greed exit' },
                 { side: 'sell', price: sma200, trigger: 'below', note: 'trend break' }]);
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  // --- ENTRY: buy extreme fear inside an intact uptrend ---
  // index < 25 = extreme fear; price above SMA200 keeps us out of bear-market knives
  if (fg < 25 && prevClose > sma200) {
    if (ctx.alloc.status !== 'ok') return null;
    ctx.state = { hi: prevClose };
    // risk 4% of equity at the 3xATR stop -> position shrinks as vol grows
    const qty = (ctx.cash * 0.04) / (3 * atr);
    if (qty <= 0) return null;
    ctx.watch([{ side: 'buy', price: 25, trigger: 'below', note: 'F&G extreme fear',
                 conds: [{ label: 'F&G index', now: fg, op: '<', ref: 25, closed: true },
                         { label: 'price>200d avg', ok: prevClose > sma200 }] }]);
    return { side: 'buy', qty: qty };
  }
  return null;
}
