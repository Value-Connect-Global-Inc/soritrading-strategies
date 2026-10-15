/*
 * @coinsori-strategy v1
 * name: dxy-change-probe (BTC 1D)
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Probe: buys only when the dxy value CHANGES between bars. If dxy is a constant
 * (misaligned dataset), it never trades. If it is real time-aligned data, it trades.
 * Not a real strategy.
 */
function onUpdate(ctx) {
  const pos = ctx.pos(ctx.sym);
  if (pos > 0) return { side: 'sell', qty: pos };
  const dxy = ctx.data('dxy');
  if (dxy == null) return null;
  const last = ctx.state.lastDxy;
  ctx.state.lastDxy = dxy;
  if (last != null && Math.abs(dxy - last) < 1e-9) return null;  // no change -> no trade
  const qty = (ctx.cash / ctx.price) * 0.99;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
