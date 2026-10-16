/*
 * @coinsori-strategy v1
 * name: BTC Donchian Profit-Lock 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The proven BTC Donchian wide-exit (55-bar high entry, 55-bar low exit) rides
 * trends well but its stated weakness is giving back profit on deep reversals before the wide exit
 * finally fires. This version adds a profit-lock: once the position is up at least 2x ATR, a stop
 * is trailed at entry + 1x ATR, so a sharp reversal converts into a locked-in gain instead of a
 * round-trip. The 55-bar low exit still handles the natural end of the trend.
 * When it buys and sells: buys when a closed daily bar breaks the 55-bar high. Sells on a 2x ATR
 * hard stop, on the profit-lock stop (only after +2x ATR), or when a closed bar breaks the 55-bar
 * low. Position size is scaled down when volatility is high.
 * When it does NOT work: in a choppy sideways market the 55-bar breakout whipsaws; the profit-lock
 * can exit early on a normal pullback right after a sharp spike, missing the rest of a strong move.
 * Drawdowns can still reach ~30-40% in sharp reversals before any stop fires.
 */
let peakSinceEntry = null; // highest close since entry (for profit-lock, reset when flat)

function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const c = ctx.closes;
  if (c.length < 120) return null;

  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0) return null;

  let h55 = -Infinity;
  for (let k = 3; k <= 57; k++) h55 = Math.max(h55, c.at(-k));
  let l55 = Infinity;
  for (let k = 3; k <= 57; k++) l55 = Math.min(l55, c.at(-k));

  const prevClose = c.at(-2);
  const pos = ctx.position;

  if (pos > 0) {
    const entry = ctx.entryPx;
    if (entry != null) {
      if (peakSinceEntry == null || prevClose > peakSinceEntry) peakSinceEntry = prevClose;
      const profit = price - entry;
      // profit-lock: only after a meaningful gain, protect a positive exit
      if (profit >= atr * 2) {
        const lockLevel = entry + atr * 1; // lock in a gain once up >= 2x ATR
        if (price <= lockLevel) return { side: 'sell', qty: pos };
        ctx.watch([{ side: 'sell', price: lockLevel, trigger: 'below', note: 'profit-lock' },
                   { side: 'sell', price: l55, trigger: 'below', note: '55-bar low breakdown' }]);
        return null;
      }
    }
    const stop = ctx.entryPx == null ? null : ctx.entryPx - atr * 2;
    if (stop != null && price <= stop) return { side: 'sell', qty: pos };
    if (prevClose < l55) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '2x ATR stop' },
               { side: 'sell', price: l55, trigger: 'below', note: '55-bar low breakdown' }]);
    return null;
  }

  peakSinceEntry = null; // flat: reset so a new entry starts fresh

  if (!(prevClose > h55)) {
    ctx.watch([{ side: 'buy', price: h55, trigger: 'above', note: '55-bar high breakout' }]);
    return null;
  }

  // ATR-scaled sizing: cut exposure when volatility is high (target 1.5% of price per ATR)
  const atrPct = atr / prevClose;
  const volScale = Math.min(1, 0.015 / atrPct);
  const qty = (ctx.cash * 0.99 * volScale) / price;
  if (qty <= 0) return null;

  ctx.watch([{ side: 'buy', price: h55, trigger: 'above', note: '55-bar high breakout' }]);
  return { side: 'buy', qty };
}
