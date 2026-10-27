/*
 * @coinsori-strategy v1
 * name: BTC On-Chain Adoption Trend 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin's price follows real network usage — when the number
 * of daily active addresses is growing, more people are actually using the chain,
 * which historically accompanies (and sometimes leads) price appreciation. This
 * strategy holds BTC only when on-chain adoption is expanding AND price is above
 * its long-term average, so it buys real usage, not just price momentum.
 * When it buys and sells: Buys when the 30-day average of daily active addresses
 * is HIGHER THAN IT WAS A WEEK AGO (adoption expanding over a week, not just one
 * day) and price is above the 200d SMA. Sells on a 3xATR trailing stop from the
 * highest close since entry or when price closes below the 200d SMA.
 * When it does NOT work: Address counts are noisy and are a lagging, not leading,
 * signal — in a rally where usage has not yet caught up it enters late, and in a
 * bear where usage stays high it can hold too long. It also whipsaws in sideways
 * markets like any trend system.
 */
function onUpdate(ctx) {
  const closes = ctx.closes;
  if (closes == null || closes.length < 210) return null;

  const pos = ctx.position;
  const price = ctx.price;
  if (price == null || price <= 0) return null;

  const sma200 = ctx.sma(200, 1);
  const atr = ctx.atr(14, 1);
  if (sma200 == null || atr == null || atr <= 0) return null;

  const prevClose = closes.at(-2);

  let st = ctx.state || {};
  if (typeof st.hi !== 'number') st.hi = prevClose;

  if (pos != null && pos > 0) {
    // Trailing stop: exit if price closes below (highest close since entry - 3*ATR).
    if (prevClose > st.hi) st.hi = prevClose;
    ctx.state = st;
    const trailStop = st.hi - 3 * atr;
    if (prevClose < trailStop || prevClose < sma200) {
      ctx.watch([{ side: 'sell', price: trailStop, trigger: 'below', note: 'trail stop 3xATR' },
                 { side: 'sell', price: sma200, trigger: 'below', note: 'below 200d SMA' }]);
      ctx.state = { hi: prevClose }; // reset -> also forces 7 fresh bars before re-entry
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  // Adoption filter: 30-day avg of active addresses higher than 7 bars ago.
  // A week-long expansion is a stronger adoption signal than a single-day tick up.
  const a = ctx.data('addr_sma30');
  if (a == null) return null; // on-chain data unknown -> cannot confirm adoption
  st.addrHist = st.addrHist || [];
  st.addrHist.push(a);
  if (st.addrHist.length > 8) st.addrHist.shift();
  const adoptionGrowing = st.addrHist.length >= 8 && a > st.addrHist[0];

  if (adoptionGrowing && prevClose > sma200) {
    if (ctx.alloc.status !== 'ok') return null; // reduce-only edge, no new entries
    ctx.state = { hi: prevClose, addrHist: st.addrHist };
    const qty = (ctx.cash / price) * 0.99;
    if (qty <= 0) return null;
    ctx.watch([{ side: 'buy', note: 'adoption expanding above 200d' }]);
    return { side: 'buy', qty: qty };
  }
  ctx.state = st;
  return null;
}
