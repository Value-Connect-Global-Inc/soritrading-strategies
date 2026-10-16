/*
 * @coinsori-strategy v1
 * name: Cross-Sectional Momentum Rotation Top1
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: in crypto, relative strength persists — the coin that
 * outperformed tends to keep outperforming. Instead of timing the market with
 * sentiment (the Fear&Greed basket), this strategy PICKS the winner: every
 * month it ranks the four coins by trailing momentum and holds only the
 * strongest one, and only while that coin is above its 200-day average
 * (defensive in bear markets).
 * When it buys and sells: on the rebalance day each month, if THIS coin has
 * the best momentum of the four AND its price is above its 200-day average,
 * buy it; otherwise sell any position. Between rebalances it holds.
 * When it does NOT work: in a choppy market leadership flips every month and
 * rotation churns (fees), and in a broad coordinated crash every coin is
 * below its 200-day average so it sits in cash and misses the start of the
 * next bull. Momentum can also be mean-reverting at extremes — the strongest
 * coin is sometimes the most crowded and reverses.
 */
function onUpdate(ctx) {
  // Monthly rebalance: every 30 bars. Between rebalances, hold.
  if (ctx.i % 30 !== 0) {
    const t = ctx.candle && ctx.candle.time;
    if (Number.isFinite(t)) {
      const next = t + (30 - (ctx.i % 30)) * 86400;
      ctx.watch([{ side: 'buy', at: next, note: 'next monthly rebalance' }]);
    }
    return null;
  }

  const syms = ctx.syms;
  if (!syms || syms.length < 2) return null;

  // Rank all coins by 60-bar change (the only cross-symbol history available).
  // Coins without enough history are skipped, not fatal.
  let best = null, bestMom = -Infinity;
  for (const s of syms) {
    const m = ctx.market(s);
    if (!m) continue;
    const mom = Number(m.ch60);
    if (Number.isFinite(mom) && mom > bestMom) { bestMom = mom; best = s; }
  }
  if (best == null) return null;

  // Trend gate on THIS symbol: only hold a coin above its own 200-day average
  // (closed bar). Same defensive rule that lets the sentiment basket survive
  // bear markets — in a crash every coin is below it and we sit in cash.
  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;

  const pos = ctx.position;
  const isWinner = ctx.sym === best;

  if (pos > 0) {
    // Exit when we are no longer the winner, or the trend gate failed.
    if (!isWinner || ctx.price <= sma200) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: sma200, trigger: 'below', note: 'exit: lost rank or trend broke' }]);
    return null;
  }

  if (isWinner && ctx.price > sma200) {
    // Full size into the winner (98% to leave room for fees).
    return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.98 };
  }

  // Declare what we are waiting for so the run card shows it.
  ctx.watch([{
    side: 'buy',
    price: sma200,
    trigger: 'above',
    note: 'enter: top momentum & trend up',
    conds: [{ label: '60d momentum rank', ok: isWinner }]
  }]);
  return null;
}
