/*
 * @coinsori-strategy v1
 * name: CryptoMomentumRotation1d
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: crypto leadership rotates — altcoins lead some rallies, BTC leads others.
 * Instead of betting on one coin (which misses the bull when it exits early), this strategy always
 * holds the single strongest coin of the four by 30-day momentum, so it stays invested in the best
 * performer and only moves to cash when ALL four are losing momentum.
 * When it buys and sells: every day it compares the 30-day return of BTC, ETH, SOL and BNB (using
 * closed bars only). It holds the coin with the highest positive momentum and sells any coin that
 * is no longer the leader. If every coin has negative momentum, it holds cash.
 * When it does NOT work: in a fast whipsaw where leadership flips every few days, rotation churns and
 * fees eat the edge. It also has no short side — a bear market where all four fall together just
 * leaves it in cash (safe, but no profit). One hot coin in a falling market can fool the momentum
 * rank into holding a bubble.
 */
function onUpdate(ctx) {
  const sym = ctx.sym;
  const st = ctx.state;
  if (!st.closes) st.closes = {};
  if (!st.mom) st.mom = {};

  // Record this coin's last CLOSED bar so backtest, paper and live agree.
  const arr = st.closes[sym] || (st.closes[sym] = []);
  const px = ctx.closes.at(-2);
  if (px == null) return null;
  arr.push(px);
  if (arr.length > 60) arr.shift();
  if (arr.length < 31) return null; // need 30 prior closed bars for momentum
  st.mom[sym] = px / arr[arr.length - 31] - 1; // 30-day momentum, closed bars only

  // Pick the strongest coin across the whole universe.
  let best = null, bestMom = -Infinity;
  for (const s of ctx.syms) {
    const m = st.mom[s];
    if (m != null && m > bestMom) { bestMom = m; best = s; }
  }
  if (best == null) return null; // not all coins warmed up yet

  const pos = ctx.pos(sym);
  const holdBest = bestMom > 0 && best === sym; // hold ONLY the leader, and only if momentum is positive

  if (pos > 0 && !holdBest) {
    return { side: 'sell', qty: pos }; // no longer the leader (or whole market weak) -> cash
  }
  if (pos <= 0 && holdBest) {
    return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.99 }; // all-in on the leader
  }
  return null;
}
