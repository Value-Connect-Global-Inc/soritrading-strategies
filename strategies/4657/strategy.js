/*
 * @coinsori-strategy v1
 * name: XRP Donchian FearGreed Gate 1D
 * ex: binance
 * syms: XRP/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The XRP turtle trend engine (55-bar breakout, rising 200-SMA,
 * 30-bar low exit, 15% hard stop) on daily bars, gated by the daily Crypto Fear &
 * Greed Index. On 1d bars the daily F&G value aligns with the bar, so the gate
 * actually fires here (it is silent on 4h). Buying a breakout while sentiment is
 * already euphoric (F&G >= 70) is a late-cycle entry, so those are skipped.
 * When it buys and sells: buy when the last closed 1d bar exceeds the highest high
 * of the prior 55 closed bars AND the 200-SMA is rising AND Fear & Greed is below
 * 70. Sell when a closed bar falls below the lowest low of the prior 30 closed
 * bars, or a 15% hard stop is hit.
 * When it does NOT work: it whipsaws in sideways ranges above a flat 200-SMA,
 * misses the very start of a fresh bull that begins from a falling 200-SMA, and
 * loses in fast crashes because the 15% stop is wide. The gate does not protect
 * against crashes that start from moderate sentiment.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const c = ctx.closes;
  if (c.length < 260) return null;
  const prevClose = c.at(-2);

  const sma200 = ctx.sma(200, 1);
  const sma200Prev = ctx.sma(200, 21);   // 200-SMA 20 bars earlier -> slope check

  // Donchian levels from CLOSED bars, EXCLUDING the signal bar itself
  let h55 = -Infinity;
  for (let k = 3; k <= 57; k++) h55 = Math.max(h55, c.at(-k));   // 55 prior bars
  let l30 = Infinity;
  for (let k = 3; k <= 32; k++) l30 = Math.min(l30, c.at(-k));   // 30 prior bars (looser exit)

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const stop = ctx.entryPx * 0.85;   // hard stop 15% below entry
    if (price <= stop) return { side: 'sell', qty: pos };
    if (prevClose < l30) return { side: 'sell', qty: pos };   // 30-bar low breakdown
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '15% stop' },
               { side: 'sell', price: l30, trigger: 'below', note: '30-bar low breakdown' }]);
    return null;
  }

  if (sma200 == null || sma200Prev == null) return null;
  if (!(prevClose > h55)) return null;                       // breakout
  if (!(sma200 > sma200Prev)) return null;                   // 200-SMA must be RISING

  // Fear & Greed gate: 70+ = extreme-greed (euphoria) zone, skip the breakout buy
  const fg = ctx.data('fear_greed');
  if (fg == null || fg >= 70) return null;

  ctx.watch([{ side: 'buy', price: h55, trigger: 'above', note: '55-bar high breakout',
               conds: [{ label: '200-SMA rising', ok: sma200 > sma200Prev, closed: true },
                       { label: 'F&G below 70', ok: fg < 70, closed: true }] }]);

  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0 || prevClose <= 0) return null;
  const atrPct = atr / prevClose;
  const volScale = Math.min(1, 0.015 / atrPct);   // daily noise: target 1.5% ATR, cap size
  const targetCash = ctx.cash * 0.95 * volScale;
  const qty = (targetCash / price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
