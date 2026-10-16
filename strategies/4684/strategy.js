/*
 * @coinsori-strategy v1
 * name: BTC OnChain Adoption 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin's number of daily active addresses is a proxy
 * for real network usage. When usage is growing (addresses above their own
 * 30-day average) while price is in an uptrend, that is fundamental adoption
 * supporting the trend — a different signal axis from price alone.
 * When it buys and sells: buys when the 30-day average of active addresses
 * is rising above its own 30-day average AND a closed daily bar is above a
 * rising 200-SMA. Sells when price breaks the 200-SMA or falls below a
 * 2.5x ATR trail anchored to the highest close since entry.
 * When it does NOT work: adoption is slow-moving — it can stay positive for
 * months while price corrects (late 2021), and it can lag the very start of
 * a bull run because price must first reclaim the 200-SMA. In a broad bear
 * market it stays flat (safe but no upside).
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const c = ctx.closes;
  if (c.length < 260) return null;

  const addr = ctx.data('addr');
  const addrSma = ctx.data('addr_sma30');
  if (addr == null || addrSma == null) return null;   // no on-chain data for this bar

  const sma200 = ctx.sma(200, 1);
  const sma200prev = ctx.sma(200, 2);
  const atr = ctx.atr(14, 1);
  if (sma200 == null || sma200prev == null || atr == null || atr <= 0) return null;

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const peak = ctx.state.peak != null ? Math.max(ctx.state.peak, price) : price;
    ctx.state.peak = peak;
    const trailStop = peak - 2.5 * atr;
    if (price < trailStop || price < sma200) {
      ctx.state.peak = null;
      return { side: 'sell', qty: pos };
    }
    ctx.watch([{ side: 'sell', price: trailStop, trigger: 'below', note: '2.5x ATR trail' },
               { side: 'sell', price: sma200, trigger: 'below', note: '200-SMA break' }]);
    return null;
  }

  const uptrend = sma200 > sma200prev;
  if (!uptrend) return null;
  if (!(addr > addrSma)) return null;   // network usage must be growing

  const qty = (ctx.cash / price) * 0.50;
  if (qty <= 0) return null;
  ctx.state.peak = price;
  ctx.watch([{ side: 'buy', price: price, trigger: 'above', note: 'adoption + trend',
               conds: [{ label: 'addr > 30d avg', ok: addr > addrSma, closed: true },
                       { label: '200-SMA rising', ok: uptrend, closed: true }] }]);
  return { side: 'buy', qty };
}
