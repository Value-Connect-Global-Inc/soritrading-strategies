/*
 * @coinsori-strategy v1
 * name: On-Chain Gated Momentum 4H (BTC/USDT)
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: the champion's 1D momentum with an on-chain usage gate has
 * been the best performer across many cycles. This variant keeps the exact same
 * economic idea (30-day return > 0, close > 200-day EMA, active addresses >=
 * their 30-day average) but runs on 4H bars so entries and exits react faster
 * than once a day. Same gate, faster engine.
 * When it buys and sells: buys when the 30-day return is positive, close is above
 * the 200-day EMA, and active addresses are at/above their 30-day average. Sells on
 * a 200-day trend break, 30-day return turning negative, or a 15% hard stop.
 * When it does NOT work: 4H momentum is noisier than 1D — expect more trades and
 * more whipsaws around the trend line. If the faster timing only adds fees without
 * adding entries, this will underperform the 1D champion.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const ema200 = ctx.ema(1200, 1);   // 1200 4H bars ≈ 200 days, same economic trend line
  if (ema200 == null) return null;

  const c = ctx.closes;
  if (c.length < 182) return null;
  const prevClose = c.at(-2);
  const mom30 = prevClose / c.at(-182) - 1;   // 30-day return on 4H bars

  const atr = ctx.atr(14, 1);
  let volScale = 1;
  if (atr != null && atr > 0 && prevClose > 0) {
    const atrPct = atr / prevClose;
    volScale = Math.min(1, 0.02 / atrPct);
  }

  const addr = ctx.data('addr');
  const addrAvg = ctx.data('addr_sma30');
  let usageUp = true;
  if (addr != null && addrAvg != null) usageUp = addr >= addrAvg;

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const stop = ctx.entryPx * 0.85;
    if (price <= stop) return { side: 'sell', qty: pos };
    if (prevClose < ema200) return { side: 'sell', qty: pos };
    if (mom30 < 0) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '15% stop' },
               { side: 'sell', price: ema200, trigger: 'below', note: '200d trend break',
                 conds: [{ label: '30d return > 0', ok: mom30 > 0, closed: true }] }]);
    return null;
  }

  const uptrend = prevClose > ema200;
  ctx.watch([{ side: 'buy', price: ema200, trigger: 'above', note: 'close above 200d EMA',
    conds: [{ label: '30d return > 0', ok: mom30 > 0, closed: true },
            { label: 'close > 200-EMA', ok: uptrend, closed: true },
            { label: 'active addr >= 30d avg', ok: usageUp, closed: true }] }]);
  if (!uptrend || !(mom30 > 0) || !usageUp) return null;

  const targetCash = ctx.cash * volScale;
  const qty = (targetCash / price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
