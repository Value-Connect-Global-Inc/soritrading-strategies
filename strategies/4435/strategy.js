/*
 * @coinsori-strategy v1
 * name: Address-Confirmed BTC Trend 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin's daily active addresses measure how many wallets
 * actually use the network. When user activity is growing (30-day average of
 * active addresses above its 90-day average) it means real demand is behind a
 * price rally, not just speculation. This is the demand side of the network,
 * the same idea as using hash rate but on usage rather than mining.
 * When it buys and sells: buys when the previous close is above the 50-day EMA
 * AND active-address demand is expanding (slow 30d-vs-90d gate, not a per-bar
 * trigger). Sells when price closes below the 50-day EMA or a 2.5x ATR hard
 * stop is hit. Positions risk 4% of cash per trade, like the champion, so the
 * two on-chain axes can be compared fairly.
 * When it does NOT work: active addresses are noisy, so in a short speculative
 * spike the slow gate may keep it in cash and miss the move; and in a crash
 * driven purely by macro (not usage) it can hold too long. It is trend-
 * following, so it does not profit from range-bound price action.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const ema50 = ctx.ema(50, 1);
  const atr = ctx.atr(14, 1);
  if (ema50 == null || atr == null || atr <= 0) return null;

  // Demand gate: slow average of daily active addresses (30d vs 90d), NOT a per-bar trigger
  const addrRaw = ctx.data('addr');
  const addr = addrRaw == null ? null : Number(addrRaw);
  if (addr == null || !Number.isFinite(addr) || addr <= 0) return null;

  const buf = ctx.state.addrBuf || [];
  buf.push(addr);
  if (buf.length > 90) buf.shift();
  ctx.state.addrBuf = buf;

  let demandUp = null;
  if (buf.length >= 90) {
    let s30 = 0, s90 = 0;
    for (let i = 0; i < 90; i++) {
      if (i < 30) s30 += buf[buf.length - 1 - i];
      s90 += buf[buf.length - 1 - i];
    }
    demandUp = (s30 / 30) > (s90 / 90);
  }
  if (demandUp == null) return null;

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
                       { label: 'addr 30d > 90d', ok: demandUp, closed: true }] }]);
  if (!uptrend || !demandUp) return null;

  const riskCash = ctx.cash * 0.04;         // risk 4% of cash per trade (same as champion)
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash / price) * 0.95;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
