/*
 * @coinsori-strategy v1
 * name: Champion Baseline Multi-Asset Momentum 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Baseline copy of the validated champion 4439. Crypto assets
 * tend to keep moving in the direction they have recently moved — momentum
 * persists. Running the same simple rule on three assets independently (each leg
 * long only when its own 30-day return is positive and its own 200-day trend is
 * up), the portfolio captures rallies in whichever coin is leading, and sits in
 * cash during bear markets. Each leg is vol-targeted so no single coin dominates
 * drawdown.
 * When it buys and sells: a leg buys when the previous close is above the 200-day
 * EMA AND its 30-day return is positive; sells when the close drops below the
 * 200-day EMA, the 30-day return turns negative, or a 15% hard stop is hit.
 * When it does NOT work: in a choppy market where the 30-day return flips sign it
 * whipsaws; and all crypto majors are correlated, so in a broad crash every leg
 * falls together.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const ema200 = ctx.ema(200, 1);
  if (ema200 == null) return null;

  const c = ctx.closes;
  if (c.length < 32) return null;
  const prevClose = c.at(-2);
  const mom30 = prevClose / c.at(-32) - 1;

  const atr = ctx.atr(14, 1);
  let volScale = 1;
  if (atr != null && atr > 0 && prevClose > 0) {
    const atrPct = atr / prevClose;
    volScale = Math.min(1, 0.02 / atrPct);
  }

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const stop = ctx.entryPx * 0.85;
    if (price <= stop) return { side: 'sell', qty: pos };
    if (prevClose < ema200) return { side: 'sell', qty: pos };
    if (mom30 < 0) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '15% stop' },
               { side: 'sell', price: ema200, trigger: 'below', note: '200-day trend break',
                 conds: [{ label: '30d return > 0', ok: mom30 > 0, closed: true }] }]);
    return null;
  }

  const uptrend = prevClose > ema200;
  ctx.watch([{ side: 'buy', price: ema200, trigger: 'above', note: 'close above 200-day EMA',
               conds: [{ label: '30d return > 0', ok: mom30 > 0, closed: true },
                       { label: 'close > 200-EMA', ok: uptrend, closed: true }] }]);
  if (!uptrend || !(mom30 > 0)) return null;

  const targetCash = ctx.cash * 0.33 * volScale;
  const qty = (targetCash / price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
