/*
 * @coinsori-strategy v1
 * name: DollarRegime BTC 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: bitcoin is a zero-yield risk asset, so its fortunes are
 * largely set by the US dollar. When the dollar is weak (below its own long
 * average), money flows out of cash into risk assets and BTC tends to rise;
 * when the dollar is strong, that flow reverses. This is a macro liquidity
 * bet — a different family from price trend, sentiment indexes, or on-chain
 * usage.
 * When it buys and sells: buy when the dollar index is below its own 90-day
 * average (weak-dollar regime) AND price is above its 200-day average (avoid
 * buying into a crash). Hold while the dollar stays weak. Sell when the
 * dollar rises back above its 90-day average, or if price drops 25% below
 * entry (hard stop).
 * When it does NOT work: the dollar index is reported on business days only
 * and can be flat for long stretches, so the signal is slow. It misses most
 * of a bull run driven purely by crypto-native demand (stablecoin inflow,
 * ETF flows) while the dollar stays range-bound, and it exits too early.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const dxy = Number(ctx.data('dxy'));
  if (!Number.isFinite(dxy)) return null; // business-days-only data; no data = no decision

  // Keep our own DXY history so we compute the long average ourselves and
  // control its alignment exactly.
  const st = ctx.state || {};
  const bD = st.bD || [];
  bD.push(dxy);
  if (bD.length > 90) bD.shift();
  st.bD = bD;
  if (bD.length < 90) return null; // warm-up

  const dxyAvg = bD.reduce((s, v) => s + v, 0) / 90;
  const weakDollar = dxy < dxyAvg;

  const pos = ctx.position;
  if (pos > 0) {
    const entry = ctx.entryPx;
    if (entry != null) {
      // Hard stop: 25% caps the loss if the macro signal is slow to react.
      if (price <= entry * 0.75) return { side: 'sell', qty: pos };
      ctx.watch([{ side: 'sell', price: entry * 0.75, trigger: 'below', note: 'stop: -25%' }]);
    }
    // Dollar strengthened -> exit the risk-on regime.
    if (!weakDollar) return { side: 'sell', qty: pos };
    return null;
  }

  // Trend filter: only enter when price is above its 200-day average (closed
  // bar) so we do not buy into a crash that the slow dollar signal missed.
  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;

  if (weakDollar && price > sma200) {
    return { side: 'buy', qty: (ctx.cash / price) * 0.95 };
  }

  ctx.watch([{
    side: 'buy',
    price: weakDollar ? sma200 : price,
    trigger: 'above',
    note: 'enter: weak dollar & trend up',
    conds: [{ label: 'DXY vs 90d avg', now: dxy, op: '<', ref: dxyAvg, closed: true }]
  }]);
  return null;
}
