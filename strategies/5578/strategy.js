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
 * its long-term average, so it buys real usage, not just price momentum. It uses
 * the proven defensive exits of the golden-cross system (death cross + 3xATR trail)
 * because adoption is a bull signal that needs fast exits in crashes.
 * When it buys and sells: Buys when the 30-day average of daily active addresses
 * is higher than it was a week ago AND price is above the 200d SMA. Sells on the
 * 50/200 death cross or a 3xATR trailing stop from the highest close since entry.
 * When it does NOT work: Address counts are noisy and lag price — in a rally where
 * usage has not caught up it enters late, and it whipsaws in sideways markets.
 */
function onUpdate(ctx) {
  const closes = ctx.closes;
  if (closes == null || closes.length < 210) return null;

  const pos = ctx.position;
  const price = ctx.price;
  if (price == null || price <= 0) return null;

  const ema50 = ctx.ema(50, 1);
  const sma200 = ctx.sma(200, 1);
  const atr = ctx.atr(14, 1);
  if (ema50 == null || sma200 == null || atr == null || atr <= 0) return null;

  const prevClose = closes.at(-2);
  const ema50Prev = ctx.ema(50, 2);
  const sma200Prev = ctx.sma(200, 2);

  let st = ctx.state || {};
  if (typeof st.hi !== 'number') st.hi = prevClose;

  if (pos != null && pos > 0) {
    // Trailing stop: exit if price closes below (highest close since entry - 3*ATR).
    if (prevClose > st.hi) st.hi = prevClose;
    ctx.state = st;
    const trailStop = st.hi - 3 * atr;
    // Death cross: exit when 50d EMA crosses below 200d SMA (fast crash exit).
    const deathCross = ema50Prev != null && sma200Prev != null && ema50Prev > sma200Prev && ema50 <= sma200;
    if (deathCross || prevClose < trailStop) {
      ctx.watch([{ side: 'sell', price: trailStop, trigger: 'below', note: 'trail stop 3xATR' },
                 { side: 'sell', note: 'death cross' }]);
      ctx.state = { hi: prevClose }; // reset -> also forces 7 fresh bars before re-entry
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  // Adoption filter: 30-day avg of active addresses higher than 7 bars ago.
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
