/*
 * @coinsori-strategy v1
 * name: On-Chain Gated Momentum Basket 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin network usage is a proxy for crypto-wide risk appetite.
 * When daily active addresses are expanding relative to their own 30-day average,
 * real new users are coming into the ecosystem — the kind of demand that sustains
 * rallies across coins, not just BTC. So we use the BTC active-address gate as a
 * MARKET-WIDE regime filter for a 3-asset momentum basket: when the network is
 * expanding we ride momentum in BTC, ETH and SOL; when it is contracting we stand
 * aside even if a coin's own price momentum looks strong.
 * When it buys and sells: each leg buys when the last closed bar is above its
 * 200-day EMA, its 30-day return is positive, AND Bitcoin active addresses are
 * above their 30-day average. Sells when the closed bar drops below the 200-day
 * EMA, the 30-day return turns negative, or a 15% hard stop is hit.
 * When it does NOT work: active-address data is published with a lag and can stay
 * elevated after a top (usage peaks while price is still falling), so the filter
 * gives a false sense of support in early bear phases; and in a liquidity-driven
 * rally with no new users (e.g. stablecoin inflow pumps) it keeps the whole basket
 * out, missing the move.
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

  // BTC-wide on-chain demand gate (same dataset for every leg):
  // active addresses vs their own 30-day average. null = not ready / missing
  // dataset -> fall back to price-only (no false block).
  const addr = ctx.data('addr');
  const addrSma = ctx.data('addr_sma30');
  const networkUp = addr == null || addrSma == null ? null : addr > addrSma;

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const entry = ctx.entryPx;
    const stop = entry && entry > 0 ? entry * 0.85 : 0;   // hard stop: 15% below entry
    if (price <= stop) return { side: 'sell', qty: pos };
    if (prevClose < ema200) return { side: 'sell', qty: pos };   // trend over
    if (mom30 < 0) return { side: 'sell', qty: pos };            // momentum faded
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '15% stop' },
               { side: 'sell', price: ema200, trigger: 'below', note: '200-day trend break',
                 conds: [{ label: '30d return > 0', ok: mom30 > 0, closed: true }] }]);
    return null;
  }

  // regime gate: do NOT open new positions while BTC network usage is contracting
  if (networkUp === false) return null;
  const uptrend = prevClose > ema200;
  ctx.watch([{ side: 'buy', price: ema200, trigger: 'above', note: 'close above 200-day EMA',
               conds: [{ label: '30d return > 0', ok: mom30 > 0, closed: true },
                       { label: 'close > 200-EMA', ok: uptrend, closed: true },
                       { label: 'BTC addr > 30d avg', ok: networkUp !== false, closed: true }] }]);
  if (!uptrend || !(mom30 > 0)) return null;

  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0 || prevClose <= 0) return null;
  const atrPct = atr / prevClose;
  const volScale = Math.min(1, 0.02 / atrPct);   // calm coin gets bigger, wild coin smaller
  const targetCash = ctx.cash * 0.33 * volScale;   // split across 3 legs
  const qty = (targetCash / price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
