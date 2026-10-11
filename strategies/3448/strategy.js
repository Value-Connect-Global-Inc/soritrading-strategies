/*
 * @coinsori-strategy v1
 * name: MinerCommitment Regime Long
 * ex: binance
 * syms: BTC
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: BTC's long-term value is anchored by network fundamentals. When miners keep
 * adding hashrate (their money is committed to the network) and price is above its long-term
 * average, the market is in a healthy uptrend worth staying long in.
 * When it buys and sells: Buys when hashrate has been above its 30-day average for 3+ straight
 * days AND price is above the 200-day average. Sells when price falls 5% below the 200-day
 * average, when hashrate has been below its trend for 3+ straight days, or on a hard -12% stop.
 * When it does NOT work: In long sideways markets where price oscillates around the 200-day
 * average it whipsaws; and because the gate is slow, it rides drawdowns longer than a fast
 * momentum system would before exiting.
 */
function onUpdate(ctx) {
  const st = (ctx.state = ctx.state || {});

  // --- slow regime gate: hashrate vs its own 30-day average (smooth, avoids per-bar whipsaw) ---
  const hr = ctx.data('hashrate');
  const hrSma = ctx.data('hashrate_sma30');
  if (hr == null || hrSma == null || hrSma <= 0) return null; // data unknown -> do nothing
  const hrUp = hr > hrSma;
  st.hrDays = hrUp ? (st.hrDays || 0) + 1 : 0;       // consecutive up days
  st.hrDownDays = hrUp ? 0 : (st.hrDownDays || 0) + 1; // consecutive down days

  // --- slow price trend filter ---
  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;

  const pos = ctx.position;
  if (pos <= 0) {
    // entry: 3 straight days of growing miner commitment + price above the long-term trend
    if (st.hrDays >= 3 && ctx.price > sma200) {
      return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.99 };
    }
    return null;
  }

  // --- slow exits ---
  if (ctx.price < sma200 * 0.95 || st.hrDownDays >= 3) {
    return { side: 'sell', qty: pos }; // trend broke with a buffer, or miner commitment faded
  }
  if (ctx.entryPx != null && ctx.price < ctx.entryPx * 0.88) {
    return { side: 'sell', qty: pos }; // hard stop: -12%, cap the tail risk of a crash
  }
  return null;
}
