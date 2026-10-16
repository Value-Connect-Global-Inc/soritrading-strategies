/*
 * @coinsori-strategy v1
 * name: XRP Donchian DXY Gate 4H
 * ex: binance
 * syms: XRP/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: The proven XRP turtle engine (55-bar breakout, rising 200-SMA,
 * 30-bar low exit, 15% hard stop) gated by the US dollar index. When the dollar
 * is weak (DXY below its own 30-day average), risk appetite is high and crypto
 * breakouts tend to follow through; when the dollar is strong, crypto breakouts
 * are more likely to fail. This macro gate reaches 4h bars via ctx.macro('dxy').
 * When it buys and sells: buy when the last closed 4h bar exceeds the highest
 * high of the prior 55 closed bars AND the 200-SMA is rising AND DXY is below its
 * 30-day average. Sell when a closed bar falls below the lowest low of the prior
 * 30 closed bars, or a 15% hard stop is hit.
 * When it does NOT work: it whipsaws in sideways ranges above a flat 200-SMA,
 * lags fresh bulls that start from a falling 200-SMA, and loses in fast crashes
 * because the 15% stop is wide. The DXY gate also blocks entries during strong
 * crypto rallies that happen while the dollar is firm.
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

  // DXY macro gate: only buy breakouts while the dollar is weak.
  // DXY below its 30-day rolling average = risk-on regime. ctx.macro reaches 4h bars.
  const dxy = ctx.macro('dxy');
  if (dxy == null) return null;
  // Rolling 30-bar average of DXY tracked in state (macro is daily-ish; 30 bars ~ 5 days of 4h data is too short,
  // so use a longer window of stored values).
  const state = ctx.state || {};
  const hist = state.dxyHist || [];
  hist.push(dxy);
  if (hist.length > 240) hist.shift();   // keep last 240 bars (~40 days at 4h)
  state.dxyHist = hist;
  if (hist.length < 240) return null;    // need 240 bars of DXY history before trading
  const avg = hist.reduce((a, b) => a + b, 0) / hist.length;
  if (dxy >= avg) return null;           // dollar not weak -> skip the breakout

  ctx.watch([{ side: 'buy', price: h55, trigger: 'above', note: '55-bar high breakout',
               conds: [{ label: '200-SMA rising', ok: sma200 > sma200Prev, closed: true },
                       { label: 'DXY below 240-bar avg', ok: dxy < avg, closed: true }] }]);

  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0 || prevClose <= 0) return null;
  const atrPct = atr / prevClose;
  const volScale = Math.min(1, 0.015 / atrPct);   // 4h noise: target 1.5% ATR, cap size
  const targetCash = ctx.cash * 0.95 * volScale;
  const qty = (targetCash / price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
