/*
 * @coinsori-strategy v1
 * name: BTC Chandelier Donchian 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: A 55-day Donchian breakout is a proven trend signal on BTC (the existing
 * champion's entry). The champion exits on a fixed 55-day low breakdown, which gives back a
 * lot during fast reversals. A wide chandelier exit — trailing 5x ATR below the highest close
 * since entry — keeps most of the trend ride (like the champion) while still cutting drawdowns
 * adaptively to volatility. Same proven entry, a volatility-adaptive exit family.
 * When it buys and sells: buys when the daily close breaks above its 55-day high. Sells when
 * price falls below the highest close since entry minus 5x ATR (wide chandelier trail), or on
 * a hard 5x ATR stop from entry. Position size shrinks when volatility is high.
 * When it does NOT work: in a choppy sideways market the 55-day breakout buys false breakouts
 * and the trailing stop churns small losses; in a fast crash the 5x ATR trail gives back a
 * large chunk before triggering. It is long-only, so it never profits from a downtrend.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const c = ctx.closes;
  if (c.length < 120) return null;

  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0) return null;

  let h55 = -Infinity;
  for (let k = 3; k <= 57; k++) h55 = Math.max(h55, c.at(-k));

  const prevClose = c.at(-2);
  const pos = ctx.position;

  // Exit first: wide chandelier trail or hard 5x ATR stop from entry
  if (pos > 0) {
    let hh = ctx.entryPx == null ? price : price;
    for (let k = 2; k <= Math.min(60, c.length - 1); k++) {
      const v = c.at(-k);
      if (v != null && v > hh) hh = v;
    }
    const chandelier = hh - atr * 5;
    const stop = ctx.entryPx == null ? null : ctx.entryPx - atr * 5;
    if (stop != null && price <= stop) return { side: 'sell', qty: pos };
    if (price <= chandelier) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: chandelier, trigger: 'below', note: 'chandelier 5x ATR' },
               { side: 'sell', price: stop, trigger: 'below', note: 'entry 5x ATR stop' }]);
    return null;
  }

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
