/*
 * @coinsori-strategy v1
 * name: Hashrate-Confirmed BTC Trend 1D (trailing stop)
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin's network hash rate is a real, physical measure of
 * mining investment — it tends to rise over the long term as the network grows.
 * A rising hash rate confirms that a price rally has real network support behind
 * it, while a falling hash rate flags a rally that miners are abandoning. This
 * strategy only buys when BOTH the price trend and the network-health trend agree,
 * and a trailing stop lets winners run in strong bulls instead of exiting early.
 * When it buys and sells: buys when the previous close is above the 50-day EMA
 * AND the hash rate is above its own 30-day average (network expanding). Sells
 * when price falls 2.5x ATR below the highest close since entry (trailing stop)
 * or closes below the 50-day EMA.
 * When it does NOT work: hash rate is a slow-moving level, so in a short
 * speculative spike it stays in cash and misses the move; and in a crash driven
 * purely by macro (not mining) it can hold too long. It is trend-following, so
 * it does not profit from range-bound price action.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const ema50 = ctx.ema(50, 1);
  const atr = ctx.atr(14, 1);
  if (ema50 == null || atr == null || atr <= 0) return null;

  // Network health: current hash rate vs its own 30-day average
  const hr = ctx.data('hashrate');
  const hrSma = ctx.data('hashrate_sma30');
  const hrVal = hr == null ? null : Number(hr);
  const hrAvg = hrSma == null ? null : Number(hrSma);
  const networkHealthy = (hrVal != null && hrAvg != null && Number.isFinite(hrVal) && Number.isFinite(hrAvg) && hrAvg > 0 && hrVal > hrAvg);

  const st = ctx.state;
  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    // track highest CLOSED bar since entry for the trailing stop
    const prevClose = ctx.closes.at(-2);
    if (prevClose != null && (st.highest == null || prevClose > st.highest)) st.highest = prevClose;
    const trailBase = st.highest != null ? st.highest : ctx.entryPx;
    const stop = Math.max(ctx.entryPx - 2.5 * atr, trailBase - 2.5 * atr);   // chandelier: ratchet up with price
    if (price <= stop) return { side: 'sell', qty: pos };
    if (prevClose != null && prevClose < ema50) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: 'trailing ATR stop' },
               { side: 'sell', price: ema50, trigger: 'below', note: '50-day trend break' }]);
    return null;
  }

  st.highest = null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;
  const uptrend = prevClose > ema50;
  ctx.watch([{ side: 'buy', price: ema50, trigger: 'above', note: 'close above 50-day EMA',
               conds: [{ label: 'close > 50-EMA', ok: uptrend, closed: true },
                       { label: 'hashrate > 30d avg', ok: networkHealthy, closed: true }] }]);
  if (!uptrend || !networkHealthy) return null;

  const riskCash = ctx.cash * 0.02;        // risk 2% of cash per trade
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash / price) * 0.95;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
