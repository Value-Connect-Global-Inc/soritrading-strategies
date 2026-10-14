/*
 * @coinsori-strategy v1
 * name: Donchian Basket Portfolio CircuitBreaker 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, XRP/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The champion Donchian basket makes the most money but eats
 *   deep 62-76% drawdowns, because each coin's 2.5x ATR stop is wide. This adds
 *   a portfolio-level circuit breaker: it tracks the whole account's equity and,
 *   if it falls 25% from its peak, it forces the basket flat and only re-enters
 *   after the account makes a new high. The per-coin Donchian logic is the same
 *   as the champion; only this portfolio risk layer is added.
 * When it buys and sells: per coin, buy a 55-day high close, sell on a 20-day
 *   low, 2.5x ATR stop, or 100-EMA break. PLUS: if portfolio equity is 25%
 *   below its peak, sell everything and wait for a new equity high.
 * When it does NOT work: after a real crash the circuit breaker keeps it in cash
 *   until the equity fully recovers, so it misses the first leg of the next
 *   bull; in a slow grind it adds nothing. The 25% breaker is a blunt tool that
 *   can lock in a loss instead of riding a V-recovery.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const atr = ctx.atr(14, 1);
  const ema100 = ctx.ema(100, 1);
  if (atr == null || atr <= 0 || ema100 == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  // Portfolio equity = cash + value of every open position (this symbol's price
  // is current; for other legs we use ctx.market(sym)).price fallback to entryPx.
  let held = 0;
  let pos = 0;
  try {
    const positions = ctx.positions();
    if (Array.isArray(positions)) {
      for (const p of positions) {
        const m = ctx.market(p.sym);
        const px = m && Number.isFinite(m.price) ? m.price : p.entryPx;
        held += p.qty * px;
      }
    }
  } catch (e) { /* portfolio read unavailable — fall through to per-coin logic */ }
  pos = ctx.pos(ctx.sym);
  const equity = ctx.cash + held;

  const st = ctx.state || {};
  let peak = st.peak;
  if (peak == null || equity > peak) peak = equity;
  st.peak = peak;
  ctx.state = st;

  const drawdown = peak > 0 ? (peak - equity) / peak : 0;
  const breakerOn = drawdown >= 0.25;

  if (pos > 0) {
    const hardStop = ctx.entryPx - 2.5 * atr;
    const ll20 = ctx.low(20, 2);
    if (price <= hardStop) return { side: 'sell', qty: pos };
    if (breakerOn) return { side: 'sell', qty: pos };  // portfolio risk layer
    if (ll20 != null && prevClose <= ll20) return { side: 'sell', qty: pos };
    if (prevClose < ema100) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2.5x ATR stop' },
               { side: 'sell', price: ll20, trigger: 'below', note: '20-bar channel exit' },
               { side: 'sell', price: ema100, trigger: 'below', note: '100-EMA break' }]);
    return null;
  }

  if (breakerOn) return null;  // wait for a new equity high before re-entering

  const hh55 = ctx.high(55, 2);
  if (hh55 == null) return null;
  ctx.watch([{ side: 'buy', price: hh55, trigger: 'above', note: '55-bar breakout',
               conds: [{ label: 'close > 100-EMA', ok: prevClose > ema100, closed: true }] }]);
  if (prevClose <= hh55) return null;
  if (prevClose < ema100) return null;

  const riskCash = ctx.cash * 0.02;
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash / price) * 0.20;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
