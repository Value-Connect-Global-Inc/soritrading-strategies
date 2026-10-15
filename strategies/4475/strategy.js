/*
 * @coinsori-strategy v1
 * name: Fear-Greed Trend-Gated ETH Momentum (ETH 1D)
 * ex: binance
 * syms: ETH/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Ethereum rallies tend to run while crowd sentiment is still
 * climbing and to die once the crowd is euphoric. We ride ETH momentum but refuse
 * to enter while the Fear & Greed Index is at extreme greed (>= 75), so we skip the
 * blow-off tops that price momentum alone would let us buy.
 * When it buys and sells: buys when the 30-day return is positive, the close is above
 * the 200-day EMA, and Fear & Greed is below 75. Sells when the close falls below the
 * 200-day EMA, the 30-day return turns negative, or a 15% hard stop is hit.
 * When it does NOT work: in a melt-up where extreme greed lasts for months, the gate
 * keeps us out of the best stretch of the rally. And the Fear & Greed Index is a
 * crypto-wide sentiment gauge, not ETH-specific, so it can misread ETH-only moves.
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

  // volatility target: size so the position contributes ~2% daily vol to the pool
  const atr = ctx.atr(14, 1);
  let volScale = 1;
  if (atr != null && atr > 0 && prevClose > 0) {
    const atrPct = atr / prevClose;
    volScale = Math.min(1, 0.02 / atrPct);
  }

  // Sentiment gate: refuse to enter at extreme greed (FG >= 75). Missing data → allow.
  const fg = ctx.data('fg');
  let notEuphoric = true;
  if (fg != null) notEuphoric = fg < 75;

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const stop = ctx.entryPx * 0.85;          // hard stop: 15% below entry
    if (price <= stop) return { side: 'sell', qty: pos };
    if (prevClose < ema200) return { side: 'sell', qty: pos };   // trend over
    if (mom30 < 0) return { side: 'sell', qty: pos };            // momentum faded
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '15% stop' },
               { side: 'sell', price: ema200, trigger: 'below', note: '200-day trend break',
                 conds: [{ label: '30d return > 0', ok: mom30 > 0, closed: true }] }]);
    return null;
  }

  const uptrend = prevClose > ema200;
  const conds = [{ label: '30d return > 0', ok: mom30 > 0, closed: true },
                 { label: 'close > 200-EMA', ok: uptrend, closed: true }];
  if (fg != null) conds.push({ label: 'FG < 75', now: fg, op: '<', ref: 75, closed: true });
  ctx.watch([{ side: 'buy', price: ema200, trigger: 'above', note: 'close above 200-day EMA', conds }]);
  if (!uptrend || !(mom30 > 0) || !notEuphoric) return null;

  const targetCash = ctx.cash * volScale;      // single-asset pool, vol-scaled
  const qty = (targetCash / price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
