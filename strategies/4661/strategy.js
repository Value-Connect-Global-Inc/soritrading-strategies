/*
 * @coinsori-strategy v1
 * name: BTC Donchian Turtle 1D v2
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The proven turtle trend engine (55-bar breakout, rising
 * 200-SMA, 30-bar low exit, 15% hard stop) on daily BTC bars. An earlier BTC 1d
 * test looked weak, but it used a 1.5% ATR sizing target calibrated for 4h bars,
 * which leaves daily positions ~75% under-sized (daily ATR% is ~3-5%). This
 * version uses a 4% ATR target so the daily turtle actually deploys capital.
 * When it buys and sells: buy when the last closed 1d bar exceeds the highest
 * high of the prior 55 closed bars AND the 200-SMA is rising. Sell when a closed
 * bar falls below the lowest low of the prior 30 closed bars, or a 15% hard stop.
 * When it does NOT work: it whipsaws in sideways ranges above a flat 200-SMA,
 * lags fresh bulls that start from a falling 200-SMA, and loses in fast crashes
 * because the 15% stop is wide.
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

  ctx.watch([{ side: 'buy', price: h55, trigger: 'above', note: '55-bar high breakout',
               conds: [{ label: '200-SMA rising', ok: sma200 > sma200Prev, closed: true }] }]);

  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0 || prevClose <= 0) return null;
  const atrPct = atr / prevClose;
  // Daily ATR% is ~3-5%, so target 4% ATR per bar to deploy real capital
  // (the 1.5% target that suits 4h bars would leave 1d positions ~75% under-sized).
  const volScale = Math.min(1, 0.04 / atrPct);
  const targetCash = ctx.cash * 0.95 * volScale;
  const qty = (targetCash / price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
