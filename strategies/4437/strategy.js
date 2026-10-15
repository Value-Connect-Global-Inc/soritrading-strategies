/*
 * @coinsori-strategy v1
 * name: Multi-Asset Absolute Momentum 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Crypto assets tend to keep moving in the direction they
 * have recently moved — momentum persists. By running the SAME simple rule on
 * three assets independently (each leg long only when its own 30-day return is
 * positive and its own 200-day trend is up), the portfolio captures rallies in
 * whichever coin is leading, and sits in cash during bear markets instead of
 * holding a falling coin. This is a multi-asset rotation family, different from
 * the single-symbol trend champion.
 * When it buys and sells: a leg buys when the previous close is above the 200-day
 * EMA AND its 30-day return is positive; sells when the previous close drops below
 * the 200-day EMA, the 30-day return turns negative, or a 15% hard stop is hit.
 * Each leg is sized to 1/3 of cash so all three can be held at once.
 * When it does NOT work: in a choppy market where a coin's 30-day return flips
 * sign frequently it whipsaws; and all crypto majors are correlated, so in a
 * broad crash every leg falls together and the basket behaves like holding one
 * coin. Absolute momentum only protects the cash leg, not the held legs.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const ema200 = ctx.ema(200, 1);
  if (ema200 == null) return null;

  // 30-day absolute momentum: compare prev close to the close 31 bars ago
  const c = ctx.closes;
  if (c.length < 32) return null;
  const prevClose = c.at(-2);
  const mom30 = prevClose / c.at(-32) - 1;   // 30-day return of the last CLOSED bar

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const stop = ctx.entryPx * 0.85;        // hard stop: 15% below entry
    if (price <= stop) return { side: 'sell', qty: pos };
    if (prevClose < ema200) return { side: 'sell', qty: pos };   // trend over
    if (mom30 < 0) return { side: 'sell', qty: pos };            // momentum faded
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

  const targetCash = ctx.cash * 0.33;       // each leg wants 1/3 of the shared pool
  const qty = (targetCash / price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
