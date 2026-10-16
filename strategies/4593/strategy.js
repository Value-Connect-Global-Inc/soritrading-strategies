/*
 * @coinsori-strategy v1
 * name: OILiquidation Contrarian BTC 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: in crypto futures, when the crowd is all on one side,
 * that side gets liquidated in a cascade and the price overshoots. This
 * strategy buys the flush: after a burst of long liquidations (crowd forced
 * out) it steps in, and it exits when the crowd piles back in (open interest
 * climbing again with price). It is a positioning-sentiment bet — a
 * different family from price trend, macro, or on-chain usage.
 * When it buys and sells: buy when recent long liquidations spike AND open
 * interest is falling (forced deleveraging, not new shorts) AND price is
 * above its 200-day average. Hold while price recovers. Sell when price
 * rises 20% above the entry (target), or if price drops 25% below entry
 * (hard stop).
 * When it does NOT work: in a persistent downtrend each flush is followed by
 * another flush — the strategy buys falling knives. It also depends on
 * futures data, which is not available in all market conditions.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const oi = ctx.binanceOi();
  const liqs = ctx.binanceLiqs(5);
  if (oi == null || liqs == null) return null; // futures data missing -> no decision

  // Liquidation data shape is not documented; guard defensively.
  let longLiq = 0;
  if (typeof liqs === 'number') {
    longLiq = liqs;
  } else if (Array.isArray(liqs)) {
    for (const l of liqs) {
      if (l && typeof l.long === 'number') longLiq += l.long;
    }
  }
  if (longLiq <= 0) return null;

  const st = ctx.state || {};
  const bO = st.bO || [];
  bO.push(oi);
  if (bO.length > 10) bO.shift();
  st.bO = bO;
  if (bO.length < 10) return null;
  const oiPrev = bO[0]; // open interest ~10 bars ago
  const oiFalling = oi < oiPrev;

  const pos = ctx.position;
  if (pos > 0) {
    const entry = ctx.entryPx;
    if (entry != null) {
      if (price <= entry * 0.75) return { side: 'sell', qty: pos };
      if (price >= entry * 1.20) return { side: 'sell', qty: pos };
      ctx.watch([
        { side: 'sell', price: entry * 0.75, trigger: 'below', note: 'stop: -25%' },
        { side: 'sell', price: entry * 1.20, trigger: 'above', note: 'target: +20%' }
      ]);
    }
    return null;
  }

  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;

  // Buy the flush: long liquidations spiked AND forced deleveraging (OI down)
  // AND we are not catching a falling knife (price above 200d average).
  if (longLiq > 0 && oiFalling && price > sma200) {
    return { side: 'buy', qty: (ctx.cash / price) * 0.95 };
  }
  return null;
}
