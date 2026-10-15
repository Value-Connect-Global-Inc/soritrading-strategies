/*
 * @coinsori-strategy v1
 * name: Multi-Asset Absolute Momentum 1D (vol-targeted, trailing stop)
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
 * holding a falling coin. Each leg is sized so it contributes roughly EQUAL daily
 * risk (volatility-targeted): a calm coin gets a bigger position, a wild coin a
 * smaller one, so no single leg dominates the portfolio's drawdown.
 * When it buys and sells: a leg buys when the previous close is above the 200-day
 * EMA AND its 30-day return is positive; sells when the previous close drops below
 * the 200-day EMA, the 30-day return turns negative, or price falls 15% below the
 * highest point of the last 20 days (a trailing stop that locks in profit made
 * during a rally instead of waiting for the slow trend break to give it back).
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

  // volatility target: size the leg so it contributes ~2% daily vol to the basket
  const atr = ctx.atr(14, 1);
  let volScale = 1;
  if (atr != null && atr > 0 && prevClose > 0) {
    const atrPct = atr / prevClose;          // daily vol as a fraction of price
    volScale = Math.min(1, 0.02 / atrPct);   // calm coin = full size, wild coin = smaller
  }

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    if (ctx.entryPx == null) return null;
    // trailing stop: 15% below the highest of (entry, 20-day high) — locks in rally gains
    const high20 = ctx.high(20, 1);
    const stopBase = high20 != null ? Math.max(ctx.entryPx, high20) : ctx.entryPx;
    const stop = stopBase * 0.85;
    if (price <= stop) return { side: 'sell', qty: pos };
    if (prevClose < ema200) return { side: 'sell', qty: pos };   // trend over
    if (mom30 < 0) return { side: 'sell', qty: pos };            // momentum faded
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: 'trailing 15% stop' },
               { side: 'sell', price: ema200, trigger: 'below', note: '200-day trend break',
                 conds: [{ label: '30d return > 0', ok: mom30 > 0, closed: true }] }]);
    return null;
  }

  const uptrend = prevClose > ema200;
  ctx.watch([{ side: 'buy', price: ema200, trigger: 'above', note: 'close above 200-day EMA',
               conds: [{ label: '30d return > 0', ok: mom30 > 0, closed: true },
                       { label: 'close > 200-EMA', ok: uptrend, closed: true }] }]);
  if (!uptrend || !(mom30 > 0)) return null;

  const targetCash = ctx.cash * 0.33 * volScale;  // 1/3 of pool, scaled by volatility
  const qty = (targetCash / price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
