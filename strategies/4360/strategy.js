/*
 * @coinsori-strategy v1
 * name: BTC On-Chain Demand Trend 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Active addresses measure real network usage. When usage
 *   grows above its 30-day average inside a price uptrend (close > 200-day
 *   SMA), it signals new demand backing the rally — a fundamentally different
 *   signal from price breakouts or sentiment. We ride demand-confirmed trends
 *   and step aside when usage fades.
 * When it buys and sells: buys when BTC active addresses are above their 30-day
 *   average AND the close is above its 200-day SMA. Sells when active addresses
 *   fall back below their 30-day average, the close breaks below the 200-day
 *   SMA, or a hard 2x ATR stop is hit.
 * When it does NOT work: active addresses are a slow, lagging series — entry is
 *   late into a rally and exit is late on the fade, so it underperforms buy-and-
 *   hold in a straight-line bull. In a bear, usage falls and it stays flat
 *   (safe, no upside). If the dataset is missing, the strategy never trades.
 */
function onUpdate(ctx) {
  const sym = ctx.sym;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const addr = ctx.data('addr');
  const addrSma = ctx.data('addr_sma30');
  const sma200 = ctx.sma(200, 1);
  const atr = ctx.atr(14, 1);
  if (addr == null || addrSma == null || sma200 == null || atr == null || atr <= 0) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const pos = ctx.pos(sym);

  if (pos > 0) {
    const hardStop = ctx.entryPx - 2 * atr;
    if (price <= hardStop) return { side: 'sell', qty: pos };
    if (prevClose < sma200) return { side: 'sell', qty: pos };
    if (addr < addrSma) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2x ATR stop' },
               { side: 'sell', price: sma200, trigger: 'below', note: 'trend broken' }]);
    return null;
  }

  const demandUp = addr > addrSma;
  const inUptrend = prevClose > sma200;
  ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'uptrend',
               conds: [{ label: 'active addr > 30d avg', ok: demandUp, closed: true }] }]);
  if (!demandUp || !inUptrend) return null;

  // risk 2% of cash per trade, 2 ATR stop distance, cap at 50% of cash
  const riskCash = ctx.cash * 0.02;
  const stopDist = 2 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash / price) * 0.50;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
