/*
 * @coinsori-strategy v1
 * name: BTC Donchian Turtle Chandelier 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Same turtle trend-following as the champion (55-bar
 * breakout entry + rising 200-SMA filter + ATR-scaled position), but the
 * fixed 15% stop is replaced by a chandelier exit: the stop trails 3xATR
 * below the highest close since entry. A dynamic trailing stop locks in
 * profits as the trend runs and exits sooner in a fast crash, instead of
 * giving back a fixed 15% from entry every time.
 * When it buys and sells: buy when the last closed 4h bar exceeds the
 * highest high of the prior 55 closed bars AND the 200-SMA is rising. Sell
 * when price falls below the tighter of {chandelier stop = 3xATR below the
 * best close since entry, 20-bar low breakdown, 15% hard stop from entry}.
 * When it does NOT work: same weaknesses as the champion - it lags a fresh
 * bull that starts from a falling 200-SMA and whipsaws in a sideways range
 * above a flat 200-SMA. In a slow grind down the 20-bar low exit can still
 * give back a lot, and a tight chandelier can cut a strong trend short.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const c = ctx.closes;
  if (c.length < 260) return null;
  const prevClose = c.at(-2);
  const sma200 = ctx.sma(200, 1);
  const sma200Prev = ctx.sma(200, 21);

  // Donchian levels from CLOSED bars, excluding the signal bar itself
  let h55 = -Infinity;
  for (let k = 3; k <= 57; k++) h55 = Math.max(h55, c.at(-k));   // 55 prior bars
  let l20 = Infinity;
  for (let k = 3; k <= 22; k++) l20 = Math.min(l20, c.at(-k));   // 20 prior bars

  const atr = ctx.atr(14, 1);

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const entryPx = ctx.entryPx;
    // highest close since entry, trailed on CLOSED bars (same in backtest/live)
    const hi = ctx.state.entryHi != null ? ctx.state.entryHi : (entryPx != null ? entryPx : prevClose);
    const newHi = Math.max(hi, prevClose);
    ctx.state.entryHi = newHi;

    let stop = entryPx != null ? entryPx * 0.85 : null;      // 15% hard stop floor
    if (atr != null && atr > 0) {
      const chand = newHi - 3 * atr;                          // chandelier 3xATR (textbook value)
      stop = stop == null ? chand : Math.max(stop, chand);
    }
    if (stop == null) stop = l20;
    stop = Math.max(stop, l20);                               // 20-bar low breakdown

    if (price <= stop) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: 'chandelier/20bar/15% stop' }]);
    return null;
  }

  if (sma200 == null || sma200Prev == null) return null;
  if (!(prevClose > h55)) return null;                        // breakout
  if (!(sma200 > sma200Prev)) return null;                    // 200-SMA must be RISING

  ctx.watch([{ side: 'buy', price: h55, trigger: 'above', note: '55-bar high breakout',
               conds: [{ label: '200-SMA rising', ok: sma200 > sma200Prev, closed: true }] }]);

  if (atr == null || atr <= 0 || prevClose <= 0) return null;
  const atrPct = atr / prevClose;
  const volScale = Math.min(1, 0.015 / atrPct);   // 4h noise: target 1.5% ATR, cap size
  const targetCash = ctx.cash * 0.95 * volScale;
  const qty = (targetCash / price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
