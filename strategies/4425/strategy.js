/*
 * @coinsori-strategy v1
 * name: Fed Policy Regime BTC 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin behaves like a risk asset that thrives when central
 * banks keep money cheap. The US federal funds rate is the clearest public gauge
 * of that policy stance, and it is a completely different signal family from
 * price trend, on-chain metrics or sentiment indexes.
 * When it buys and sells: buys and holds BTC while the fed funds rate is below
 * 2% (accommodative policy = risk-on); sells flat when the rate rises to 2% or
 * above (tight policy = risk-off), or when a 2.5x ATR hard stop is hit.
 * When it does NOT work: the rate moves in long slow waves, so it reacts late to
 * policy turns and can re-enter late after a crash; and it ignores all price,
 * volume and on-chain information, so it stays long through sharp drawdowns that
 * a price-based rule would have dodged.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0) return null;

  const fed = ctx.data('fed');
  const fedVal = fed == null ? null : Number(fed);
  const easy = fedVal != null && Number.isFinite(fedVal) && fedVal < 2.0;  // loose-money regime

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const stop = ctx.entryPx - 2.5 * atr;   // hard stop: 2.5x daily ATR below entry
    if (price <= stop) return { side: 'sell', qty: pos };
    if (!easy) return { side: 'sell', qty: pos };
    return null;
  }

  if (!easy) return null;

  const riskCash = ctx.cash * 0.04;         // risk 4% of cash per trade
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash / price) * 0.95;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
