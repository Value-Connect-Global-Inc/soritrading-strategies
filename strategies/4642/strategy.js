/*
 * @coinsori-strategy v1
 * name: BTC Donchian Turtle VolumeFilter 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: The champion turtle (55-bar breakout + rising 200-SMA +
 * ATR sizing) is kept EXACTLY as-is, including its wide exits. The only new
 * rule is on the ENTRY side: the breakout bar must close on above-average
 * volume. Breakouts on heavy volume are more likely to be real and sustained,
 * so this filters out low-volume false breakouts that whip the turtle around.
 * When it buys and sells: buy when the last closed 4h bar exceeds the highest
 * high of the prior 55 closed bars, the 200-SMA is rising, AND the breakout
 * bar's volume is above its 20-bar average. Sell on the 20-bar low breakdown
 * or the 15% hard stop.
 * When it does NOT work: same weaknesses as the champion (lags fresh bulls
 * from a falling 200-SMA, whipsaws in a sideways range above a flat 200-SMA,
 * wide 15% stop eats fast-crash losses). Volume is noisier on 4h, and some
 * real trends start on low volume, so it can miss the first breakout.
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

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const stop = ctx.entryPx * 0.85;   // hard stop 15% below entry
    if (price <= stop) return { side: 'sell', qty: pos };
    if (prevClose < l20) return { side: 'sell', qty: pos };   // 20-bar low breakdown
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '15% stop' },
               { side: 'sell', price: l20, trigger: 'below', note: '20-bar low breakdown' }]);
    return null;
  }

  if (sma200 == null || sma200Prev == null) return null;
  if (!(prevClose > h55)) return null;                        // breakout
  if (!(sma200 > sma200Prev)) return null;                    // 200-SMA must be RISING

  // volume confirmation: breakout bar volume above its 20-bar average
  const vols = ctx.volumes;
  if (vols == null || vols.length < 23) return null;
  let sum = 0;
  for (let k = 3; k <= 22; k++) sum += vols.at(-k);           // 20 bars ending 2 back
  const avgVol = sum / 20;
  const breakoutVol = vols.at(-2);
  if (!(breakoutVol > avgVol)) return null;   // low-volume breakout -> skip

  ctx.watch([{ side: 'buy', price: h55, trigger: 'above', note: '55-bar high breakout',
               conds: [{ label: '200-SMA rising', ok: sma200 > sma200Prev, closed: true },
                       { label: 'breakout vol > 20-bar avg', ok: breakoutVol > avgVol, closed: true }] }]);

  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0 || prevClose <= 0) return null;
  const atrPct = atr / prevClose;
  const volScale = Math.min(1, 0.015 / atrPct);   // 4h noise: target 1.5% ATR, cap size
  const targetCash = ctx.cash * 0.95 * volScale;
  const qty = (targetCash / price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
