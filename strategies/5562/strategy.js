/*
 * @coinsori-strategy v1
 * name: BTC Fear-Greed Contrarian Tilt 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Crypto sentiment oscillates between panic and euphoria, and these
 * extremes tend to mean-revert. This single-asset BTC strategy stays always invested (the
 * proven edge in this job) but tilts position size against sentiment: it overweights in
 * extreme fear (panic is often a local bottom) and trims in extreme greed.
 * When it buys and sells: base position is always 100% invested. When Fear & Greed is very
 * low it can go to 1.5x (leverage) to buy the panic; when very high it trims to 0.5x.
 * When it does NOT work: in a genuine bear that keeps getting more fearful (no V-recovery),
 * the leveraged panic-buy adds losses. It also underperforms buy-and-hold in a steady bull
 * with no sentiment extremes.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (price == null || price <= 0) return null;

  const fg = ctx.data("fear_greed"); // 0=extreme fear, 100=extreme greed
  // Contrarian tilt: base 1.0x, overweight in fear, trim in greed.
  let mult = 1.0;
  if (fg != null && fg <= 20) mult = 1.5;
  if (fg != null && fg <= 10) mult = 1.8;
  if (fg != null && fg >= 70) mult = 0.5;
  if (fg != null && fg >= 85) mult = 0.3;

  const pos = ctx.pos(ctx.sym);
  const equity = ctx.cash + (pos > 0 ? pos * price : 0);
  const qtyTarget = mult * equity / price;

  // Rebalance only when the target moved materially.
  if (pos > 0 && Math.abs(qtyTarget - pos) / Math.max(qtyTarget, pos) < 0.2) {
    return null;
  }
  if (qtyTarget > pos) {
    ctx.watch([{ side: 'buy', note: 'fear-greed contrarian tilt up' }]);
    return { side: 'buy', qty: qtyTarget - pos };
  }
  if (qtyTarget < pos) {
    ctx.watch([{ side: 'sell', note: 'fear-greed contrarian trim' }]);
    return { side: 'sell', qty: pos - qtyTarget, reduceOnly: true };
  }
  return null;
}
