/*
 * @coinsori-strategy v1
 * name: EMA-Slope-Confirmed Multi-Asset Momentum 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The champion (multi-asset absolute momentum) is strong but
 * its stated weakness is whipsaw in choppy markets where the 30-day return flips
 * sign. A trend-confirmation filter — the 200-day EMA must itself be RISING, not
 * just price above it — was shown in the ledger's dual-side experiment to remove
 * chop-fake entries. This variant adds that filter to the champion's proven rule.
 * When it buys and sells: same as champion (close above 200-day EMA + 30-day
 * return positive), but the 200-day EMA must be rising over the last 20 bars.
 * Sells on EMA break, negative momentum, or a 15% hard stop.
 * When it does NOT work: it can miss the very start of a recovery right after a
 * long bear (EMA still falling), and it still holds correlated legs in a broad
 * crash. In a slow grind-up it may wait longer than the champion before buying.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const ema200 = ctx.ema(200, 1);
  const ema200_20 = ctx.ema(200, 21);          // 20 bars ago, same EMA
  if (ema200 == null || ema200_20 == null) return null;
  const trendRising = ema200 > ema200_20;      // 200-day EMA slope is positive

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
    if (price <= stop || prevClose < ema200 || mom30 < 0) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '15% stop' },
               { side: 'sell', price: ema200, trigger: 'below', note: '200-day trend break',
                 conds: [{ label: '30d return > 0', ok: mom30 > 0, closed: true },
                         { label: 'EMA200 rising', ok: trendRising, closed: true }] }]);
    return null;
  }

  const uptrend = prevClose > ema200;
  ctx.watch([{ side: 'buy', price: ema200, trigger: 'above', note: 'close above 200-day EMA',
               conds: [{ label: '30d return > 0', ok: mom30 > 0, closed: true },
                       { label: 'close > 200-EMA', ok: uptrend, closed: true },
                       { label: 'EMA200 rising', ok: trendRising, closed: true }] }]);
  if (!uptrend || !(mom30 > 0) || !trendRising) return null;

  const targetCash = ctx.cash * 0.33 * volScale;
  const qty = (targetCash / price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
