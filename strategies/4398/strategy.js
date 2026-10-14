/*
 * @coinsori-strategy v1
 * name: Momentum Rotation Top-5 Coins 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, XRP/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Crypto rotates — one coin leads a leg, then another. Instead of
 * guessing which, hold the strongest of five majors by 30-day momentum and switch
 * only when the lead changes. This is a different family from the hashrate-champion:
 * no on-chain data, pure price momentum, but multi-asset so it can sidestep a weak
 * single coin by holding whichever is currently strongest.
 * When it buys and sells: each day, compute every symbol's 30-day return and buy the
 * top-ranked one (equal weight to the leader). Sell a symbol when it is no longer
 * ranked first and buy the new leader. Hard -20% stop on every position.
 * When it does NOT work: in a broad coordinated crash all five fall together and the
 * rotation just picks the least-bad — it does not hedge. Frequent re-ranking in a
 * choppy market churns fees. A single rocket coin (e.g. SOL 2021) beats it.
 */
function onUpdate(ctx) {
  const sym = ctx.sym;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  // accumulate each symbol's daily price history in the shared state
  const st = ctx.state;
  if (st.hist == null) st.hist = {};
  if (st.hist[sym] == null) st.hist[sym] = [];
  st.hist[sym].push(price);
  const h = st.hist[sym];
  if (h.length > 40) h.shift();

  const lookback = 30;
  if (h.length < lookback + 1) return null;

  // momentum of the CURRENT symbol from our own accumulated history
  const cur = h[h.length - 1];
  const past = h[h.length - 1 - lookback];
  if (past <= 0) return null;
  const myScore = cur / past - 1;

  const pos = ctx.pos(sym);
  if (pos > 0) {
    if (ctx.entryPx != null && price < ctx.entryPx * 0.80) {
      return { side: 'sell', qty: pos };
    }
    // rotate out only when another symbol clearly beats us by a margin
    const leader = ctx.syms.map(s => ({ s, sc: st.hist[s] && st.hist[s].length >= lookback + 1 ? st.hist[s][st.hist[s].length - 1] / st.hist[s][st.hist[s].length - 1 - lookback] - 1 : null }))
      .filter(x => x.sc != null)
      .reduce((a, b) => a == null || b.sc > a.sc ? b : a, null);
    if (leader == null) return null;
    if (sym !== leader.s && leader.sc > myScore * 1.02) {
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  // buy only the current leader
  const leader2 = ctx.syms.map(s => ({ s, sc: st.hist[s] && st.hist[s].length >= lookback + 1 ? st.hist[s][st.hist[s].length - 1] / st.hist[s][st.hist[s].length - 1 - lookback] - 1 : null }))
    .filter(x => x.sc != null)
    .reduce((a, b) => a == null || b.sc > a.sc ? b : a, null);
  if (leader2 == null || sym !== leader2.s) return null;

  const qty = (ctx.cash / price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
