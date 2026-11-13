/*
 * @coinsori-strategy v1
 * name: BTC 4H VIX-Calm Momentum
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: BTC trends most reliably when there is no equity-market panic.
 * Buying a fresh 20-bar-high breakout only when the VIX is calm keeps exposure high in
 * calm uptrends and avoids buying into panic crashes. Exiting when price breaks the
 * 20-bar low (or a 15% disaster stop) cuts losing legs early so the account stays
 * invested through most of a bull market.
 * When it buys and sells: buys when price closes above the 20-bar high while the VIX
 * z-score is below 1.5; sells when price breaks below the 20-bar low or drops 15%
 * below the entry price.
 * When it does NOT work: a long sideways range where 20-bar highs keep failing (small
 * repeated losses plus fees), and a slow-bleed bear where price grinds below the
 * 20-bar low repeatedly with no panic to explain it.
 */
function onUpdate(ctx) {
  const vix = ctx.data("base.vix");
  const pos = ctx.position || 0;
  const st = ctx.state;

  // rolling history of distinct daily VIX prints (dedupe: one daily value spans ~6 4h bars)
  if (vix != null) {
    if (!Array.isArray(st.vixHist)) st.vixHist = [];
    if (st.vixHist[st.vixHist.length - 1] !== vix) st.vixHist.push(vix);
    if (st.vixHist.length > 120) st.vixHist.shift();
  }

  // VIX z-score vs its own history, after ~2 months of distinct prints
  let vz = null;
  if (vix != null && Array.isArray(st.vixHist) && st.vixHist.length >= 60) {
    const mean = st.vixHist.reduce((a, b) => a + b, 0) / st.vixHist.length;
    const sd = Math.sqrt(st.vixHist.reduce((a, b) => a + (b - mean) * (b - mean), 0) / st.vixHist.length);
    vz = sd > 0 ? (vix - mean) / sd : 0;
  }

  // 20-bar channel from CLOSED bars only (same in backtest, paper and live)
  let hh20 = -Infinity, ll20 = Infinity;
  for (let i = 1; i <= 20; i++) {
    hh20 = Math.max(hh20, ctx.highs.at(-1 - i));
    ll20 = Math.min(ll20, ctx.lows.at(-1 - i));
  }
  if (!isFinite(hh20) || !isFinite(ll20)) return null;
  const price = ctx.price;

  if (pos > 0) {
    // 15% disaster stop from entry; the 20-bar low is the normal trend exit
    if (st.stop == null) st.stop = (ctx.entryPx != null ? ctx.entryPx : price) * 0.85;
    ctx.watch([
      { side: 'sell', price: ll20, trigger: 'below', note: '20-bar low exit' },
      { side: 'sell', price: st.stop, trigger: 'below', note: '15% stop' }
    ]);
    if (price < ll20 || price <= st.stop) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  st.stop = null;
  ctx.watch([
    { side: 'buy', price: hh20, trigger: 'above', note: '20-bar high breakout',
      conds: [{ label: 'VIX z-score', now: vz, op: '<', ref: 1.5 }] }
  ]);
  if (vz != null && vz < 1.5 && price > hh20) {
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.95 };
  }
  return null;
}
