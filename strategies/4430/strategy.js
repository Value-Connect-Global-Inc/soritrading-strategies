/*
 * @coinsori-strategy v1
 * name: Network-Usage Confirmed BTC Trend 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin's daily active addresses measure real network
 * usage — a growing number of users transacting supports a price rally, while
 * a rally on shrinking usage is a speculative bubble. This strategy buys only
 * when BOTH the price trend and the usage trend agree.
 * When it buys and sells: buys when the previous close is above the 50-day EMA
 * AND today's active-address count is above its 30-day average (network
 * expanding). Sells when price closes below the 50-day EMA or a 2.5x ATR hard
 * stop is hit. Positions are sized so each trade risks 4% of cash.
 * When it does NOT work: active addresses are a slow-moving level, so it stays
 * in cash during short speculative spikes and misses them. It is trend-
 * following, so it does not profit from range-bound price action, and it can
 * hold too long in a macro-driven crash that usage data does not anticipate.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const ema50 = ctx.ema(50, 1);
  const atr = ctx.atr(14, 1);
  if (ema50 == null || atr == null || atr <= 0) return null;

  // Network usage: current active addresses vs their 30-day average
  const addr = ctx.data('addr');
  const addrAvg = ctx.data('addr_sma30');
  const aVal = addr == null ? null : Number(addr);
  const aAvg = addrAvg == null ? null : Number(addrAvg);
  const usageUp = (aVal != null && aAvg != null && Number.isFinite(aVal) && Number.isFinite(aAvg) && aAvg > 0 && aVal > aAvg);

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const stop = ctx.entryPx - 2.5 * atr;   // hard stop: 2.5x daily ATR below entry
    if (price <= stop) return { side: 'sell', qty: pos };
    const prevClose = ctx.closes.at(-2);
    if (prevClose != null && prevClose < ema50) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '2.5x ATR stop' },
               { side: 'sell', price: ema50, trigger: 'below', note: '50-day trend break' }]);
    return null;
  }

  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;
  const uptrend = prevClose > ema50;
  ctx.watch([{ side: 'buy', price: ema50, trigger: 'above', note: 'close above 50-day EMA',
               conds: [{ label: 'close > 50-EMA', ok: uptrend, closed: true },
                       { label: 'addr > 30d avg', ok: usageUp, closed: true }] }]);
  if (!uptrend || !usageUp) return null;

  const riskCash = ctx.cash * 0.04;         // risk 4% of cash per trade
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash / price) * 0.95;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
