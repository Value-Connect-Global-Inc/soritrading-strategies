/*
 * @coinsori-strategy v1
 * name: Multi-Asset Momentum ATR-Trail 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Crypto assets keep moving in the direction they have
 * recently moved — momentum persists. Same core rule as the champion, but the
 * hard exit is an ATR chandelier trail instead of a fixed 15% stop. A trailing
 * stop adapts to volatility: it locks in gains during fast up-moves and exits
 * quicker during violent crashes, because the stop distance is measured in
 * ATRs, not a fixed percentage.
 * When it buys and sells: a leg buys when the previous close is above the
 * 200-day EMA AND its 30-day return is positive. It sells when the close drops
 * below the 200-day EMA, the 30-day return turns negative, or the price falls
 * below the highest close since entry minus 3x ATR(14). The trail never sits
 * tighter than 10% below entry so it cannot be stopped out by noise.
 * When it does NOT work: in a choppy market a coin's 30-day return flips sign
 * and it whipsaws; and all crypto majors are correlated, so a broad crash still
 * hits every held leg together.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const ema200 = ctx.ema(200, 1);
  if (ema200 == null) return null;

  const c = ctx.closes;
  if (c.length < 32) return null;
  const prevClose = c.at(-2);
  const mom30 = prevClose / c.at(-32) - 1;   // 30-day return of the last CLOSED bar

  const atr = ctx.atr(14, 1);
  let volScale = 1;
  if (atr != null && atr > 0 && prevClose > 0) {
    const atrPct = atr / prevClose;
    volScale = Math.min(1, 0.02 / atrPct);   // ~2% daily vol per leg
  }

  const pos = ctx.pos(ctx.sym);
  const s = ctx.state;
  if (pos > 0) {
    // track the highest close since entry to build the trail
    if (s.peak == null || prevClose > s.peak) s.peak = prevClose;
    let trail = null;
    if (atr != null && atr > 0 && s.peak != null) {
      trail = s.peak - 3 * atr;              // chandelier: 3 ATRs below the peak
      const floor = ctx.entryPx * 0.90;      // never tighter than 10% below entry
      if (trail < floor) trail = floor;
    }
    if (trail != null) {
      if (price <= trail) return { side: 'sell', qty: pos };
      ctx.watch([{ side: 'sell', price: trail, trigger: 'below', note: 'ATR trail' },
                 { side: 'sell', price: ema200, trigger: 'below', note: '200-day trend break',
                   conds: [{ label: '30d return > 0', ok: mom30 > 0, closed: true }] }]);
    }
    if (prevClose < ema200) return { side: 'sell', qty: pos };
    if (mom30 < 0) return { side: 'sell', qty: pos };
    return null;
  }
  s.peak = null;   // reset trail when flat

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
