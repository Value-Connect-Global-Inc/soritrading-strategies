/*
 * @coinsori-strategy v1
 * name: Fear-Greed Contrarian Dip (BTC 1D)
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: crypto sentiment (Fear & Greed index) is contrarian — panic
 * lows mark good entry points inside a longer uptrend, and euphoria marks exits.
 * We buy panic dips only while the 200-day trend is up, and sell when greed peaks
 * or the trend breaks.
 * When it buys and sells: buys when the Fear & Greed index is at/below 25 while the
 * close is above the 200-day EMA. Sells when the index reaches 70+, the close falls
 * below the 200-day EMA, or a 20% hard stop is hit.
 * When it does NOT work: in a prolonged bear market the close stays below the 200-day
 * EMA so we rarely buy and miss the eventual bottom. The Fear & Greed index is a
 * lagging sentiment poll — sharp crashes can take weeks to reach "extreme fear".
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const ema200 = ctx.ema(200, 1);
  if (ema200 == null) return null;

  const c = ctx.closes;
  if (c.length < 32) return null;
  const prevClose = c.at(-2);

  // volatility target: size so the position contributes ~2% daily vol to the pool
  const atr = ctx.atr(14, 1);
  let volScale = 1;
  if (atr != null && atr > 0 && prevClose > 0) {
    const atrPct = atr / prevClose;
    volScale = Math.min(1, 0.02 / atrPct);
  }

  const fg = ctx.data('fear_greed');
  // missing sentiment data -> we cannot confirm a panic, so we stay out (safe default)

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const stop = ctx.entryPx * 0.80;          // hard stop: 20% below entry
    if (price <= stop) return { side: 'sell', qty: pos };
    if (prevClose < ema200) return { side: 'sell', qty: pos };   // trend over
    if (fg != null && fg >= 70) return { side: 'sell', qty: pos }; // greed exit
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '20% stop' },
               { side: 'sell', price: ema200, trigger: 'below', note: '200-day trend break',
                 conds: [{ label: 'FG < 70', ok: fg == null || fg < 70, closed: true }] }]);
    return null;
  }

  const uptrend = prevClose > ema200;
  const panic = fg != null && fg <= 25;
  ctx.watch([{ side: 'buy', price: ema200, trigger: 'above', note: 'close above 200-EMA',
               conds: [{ label: 'FG <= 25 (panic)', ok: panic, closed: true },
                       { label: 'close > 200-EMA', ok: uptrend, closed: true }] }]);
  if (!uptrend || !panic) return null;

  const targetCash = ctx.cash * volScale;
  const qty = (targetCash / price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
