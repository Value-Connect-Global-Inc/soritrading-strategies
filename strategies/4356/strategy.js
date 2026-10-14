/*
 * @coinsori-strategy v1
 * name: BTC Address-Momentum Trend 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: On-chain usage as a leading signal. Bitcoin's daily unique
 *   active addresses measure real network adoption; when usage is growing
 *   (today's addresses above their 30-day average) the network is being used
 *   more, and price usually follows. This is a different axis from price
 *   breakouts or sentiment — it bets on adoption growth, not on momentum.
 * When it buys and sells: buy when active addresses are above their 30-day
 *   average AND the 1d close is above its 100-day EMA. Sell when the close
 *   drops below the 100-day EMA, when usage stalls (addresses below their
 *   30-day average), or on a 2.5x ATR hard stop.
 * When it does NOT work: in a pure speculative melt-up with no real usage
 *   growth (addresses flat or falling while price pumps) it stays out and
 *   misses the rally; on-chain data is noisy and lags, so entries are late
 *   versus price-only breakouts.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const addr = ctx.data('addr');
  const addrSma30 = ctx.data('addr_sma30');
  if (addr == null || addrSma30 == null || addrSma30 <= 0) return null;

  const pos = ctx.pos(ctx.sym);

  if (pos > 0) {
    const ema100 = ctx.ema(100, 1);
    const hardStop = ctx.entryPx - 2.5 * atr;
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2.5x ATR stop' },
               { side: 'sell', price: ema100, trigger: 'below', note: '100-EMA break' }]);
    if (price <= hardStop) return { side: 'sell', qty: pos };
    if (ema100 != null && prevClose < ema100) return { side: 'sell', qty: pos };
    if (addr < addrSma30) return { side: 'sell', qty: pos }; // usage stalling
    return null;
  }

  const ema100 = ctx.ema(100, 1);
  if (ema100 == null) return null;
  ctx.watch([{ side: 'buy', price: ema100, trigger: 'above', note: '100-EMA + usage up',
               conds: [{ label: 'addr > 30d avg', ok: addr > addrSma30, closed: true }] }]);
  if (prevClose <= ema100) return null;
  if (addr <= addrSma30) return null; // need usage accelerating

  const riskCash = ctx.cash * 0.02;      // risk 2% of cash on the stop
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash / price) * 0.50; // single asset, cap at 50% of cash
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
