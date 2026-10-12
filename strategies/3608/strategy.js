/*
 * @coinsori-strategy v1
 * name: Multi-Asset Momentum Rotation 4H
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, BNB/USDT, SOL/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: cross-sectional momentum — the strongest of the big four
 *   coins over the last 40 bars tends to keep outperforming for a while
 *   (relative-strength persistence). Instead of betting on one trend, this rides
 *   whichever coin is currently the strongest.
 * When it buys and sells: a coin is held only while it is the top-momentum coin
 *   AND above its 200-SMA; it enters on a fresh 55-bar high break and exits when
 *   it loses the leadership, breaks its 20-bar channel low, or hits a 2.5x ATR
 *   hard stop.
 * When it does NOT work: when all coins move together in a tight range or a
 *   synchronized bear, the leader keeps changing and rotation pays fees without
 *   gains.
 */
function onUpdate(ctx) {
  const syms = (ctx.syms && ctx.syms.length) ? ctx.syms : [ctx.sym];
  const lookback = 40;
  const atr = ctx.atr(14, 1);
  const sma200 = ctx.sma(200, 1);
  if (atr == null || sma200 == null) return null;

  // momentum score per symbol: current price vs close `lookback` bars ago
  const scores = [];
  for (const s of syms) {
    let now = null, old = null;
    if (s === ctx.sym) {
      now = ctx.price;
      const c = ctx.closes;
      if (c && c.length > lookback + 1) old = c.at(-1 - lookback);
    } else {
      const m = ctx.market(s);
      if (m && typeof m.price === 'number') now = m.price;
      const mc = m && m.closes;
      if (mc && mc.length > lookback + 1) old = mc.at(-1 - lookback);
    }
    if (now != null && old != null && old > 0) {
      scores.push({ sym: s, mom: now / old - 1 });
    }
  }
  if (scores.length === 0) return null;
  scores.sort((a, b) => b.mom - a.mom);
  const isLeader = scores[0].sym === ctx.sym;

  const price = ctx.price;
  const prevClose = ctx.closes.at(-2);

  if (ctx.position > 0) {
    const hardStop = ctx.entryPx - 2.5 * atr;
    const ll20 = ctx.low(20, 2);
    if (price <= hardStop) return { side: 'sell', qty: ctx.position };
    if (ll20 != null && prevClose <= ll20) return { side: 'sell', qty: ctx.position };
    if (!isLeader) return { side: 'sell', qty: ctx.position };   // lost leadership -> rotate out
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2.5x ATR hard stop' },
               { side: 'sell', price: ll20, trigger: 'below', note: '20-bar channel exit' }]);
    return null;
  }

  if (!isLeader) return null;
  if (prevClose <= sma200) return null;   // don't buy a leader that is below its long-term trend
  const hh55 = ctx.high(55, 2);
  if (hh55 == null || prevClose <= hh55) return null;   // enter only on a FRESH breakout

  // risk 2% of cash on a 2.5x ATR stop, capped by available cash
  const riskCash = ctx.cash * 0.02;
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.99) / price;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
