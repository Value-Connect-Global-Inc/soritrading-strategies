/*
 * @coinsori-strategy v1
 * name: Trailing-Stop Momentum (BTC 1D)
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Same on-chain-confirmed momentum entry as the champion,
 * but the exit is a TRAILING stop that ratchets up with the highest close since
 * entry. A real trend is not cut short by a fixed stop, while a reversal still
 * caps the loss.
 * When it buys and sells: buys when 30d return > 0, close above 200d EMA and
 * active addresses >= 30d average. Sells when price falls 15% below the highest
 * close since entry, close breaks the 200d EMA, or 30d return turns negative.
 * When it does NOT work: in choppy sideways markets the trail gives back gains
 * before the trend exit fires; the usage gate only reads BTC, so no protection
 * for other coins. Misses sharp V-recoveries because usage is still low.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const ema200 = ctx.ema(200, 1);
  if (ema200 == null) return null;

  const c = ctx.closes;
  if (c.length < 32) return null;
  const prevClose = c.at(-2);
  const mom30 = prevClose / c.at(-32) - 1;   // 30-day return of last CLOSED bar

  const atr = ctx.atr(14, 1);
  let volScale = 1;
  if (atr != null && atr > 0 && prevClose > 0) {
    const atrPct = atr / prevClose;
    volScale = Math.min(1, 0.02 / atrPct);   // size so position contributes ~2% daily vol
  }

  const pos = ctx.position;
  if (pos > 0) {
    // Trailing peak = highest close over the last 30 bars (approx peak since entry).
    let peak = prevClose;
    for (let k = 2; k <= 30 && k < c.length; k++) {
      const v = c.at(-k);
      if (Number.isFinite(v) && v > peak) peak = v;
    }
    const trail = Math.max(ctx.entryPx * 0.85, peak * 0.85);   // never below the 15% entry stop
    if (price <= trail) return { side: 'sell', qty: pos };
    if (prevClose < ema200) return { side: 'sell', qty: pos };  // trend over
    if (mom30 < 0) return { side: 'sell', qty: pos };           // momentum faded
    ctx.watch([{ side: 'sell', price: trail, trigger: 'below', note: '15% trailing stop' },
               { side: 'sell', price: ema200, trigger: 'below', note: '200-day trend break',
                 conds: [{ label: '30d return > 0', ok: mom30 > 0, closed: true }] }]);
    return null;
  }

  const addr = ctx.data('addr');
  const addrAvg = ctx.data('addr_sma30');
  let usageUp = true;
  if (addr != null && addrAvg != null) usageUp = addr >= addrAvg;

  const uptrend = prevClose > ema200;
  ctx.watch([{ side: 'buy', price: ema200, trigger: 'above', note: 'close above 200-day EMA',
               conds: [{ label: '30d return > 0', ok: mom30 > 0, closed: true },
                       { label: 'close > 200-EMA', ok: uptrend, closed: true },
                       { label: 'active addr >= 30d avg', ok: usageUp, closed: true }] }]);
  if (!uptrend || !(mom30 > 0) || !usageUp) return null;

  const targetCash = ctx.cash * volScale;
  const qty = (targetCash / price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
