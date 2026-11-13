/*
 * @coinsori-strategy v1
 * name: VolExpansion Breakout 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Breakouts backed by above-average volume or expanding
 * volatility are real trend starts, not noise, so they are worth following.
 * When it buys and sells: it buys long when the last closed 4h bar breaks its
 * 20-bar high while price is above its 200-bar average and volume or volatility
 * confirms; it sells when the close falls below its 200-bar average (regime
 * turned down) or below the hard stop set at entry.
 * When it does NOT work: in a sideways market volume spikes are traps and the
 * stops bleed the account; and it underperforms holding in a smooth straight-up
 * bull market.
 */

function onUpdate(ctx) {
  const price = ctx.price;
  const pos = ctx.position || 0;

  function donHigh(ago, n) {
    let h = -Infinity;
    for (let k = ago + 1; k <= ago + n; k++) h = Math.max(h, ctx.highs.at(-k));
    return h;
  }

  // Manage an open position first (never blocked by warm-up).
  if (pos > 0) {
    const sma200 = ctx.sma(200, 1);
    const atrNow = ctx.atr(14, 1);
    const hardStop = ctx.state.stop != null ? ctx.state.stop : (atrNow != null ? price - 3 * atrNow : price * 0.9);
    // Regime exit: close below the 200-bar average = trend turned down.
    let exitPx = sma200 != null ? sma200 : hardStop;
    exitPx = Math.max(exitPx, hardStop); // never below the hard stop
    ctx.watch([{ side: 'sell', price: exitPx, trigger: 'below', note: 'SMA200 regime exit' }]);
    if (exitPx > 0 && price <= exitPx) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }

  if (ctx.closes.length < 220 || ctx.highs.length < 22 || ctx.volumes.length < 22) {
    ctx.watch([]);
    return null;
  }

  const prevClose = ctx.closes.at(-2);
  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) { ctx.watch([]); return null; }
  const uptrend = prevClose > sma200;

  const vols = ctx.volumes;
  let vsum = 0;
  for (let k = 2; k <= 21; k++) vsum += vols.at(-k);
  const avgVol = vsum / 20;
  const volConfirmed = vols.at(-2) > avgVol * 1.2;

  const atrNow = ctx.atr(14, 1);
  const atr10 = ctx.atr(14, 11);
  const volExpanding = atrNow != null && atr10 != null && atrNow > atr10;

  // Confirmation: volume OR volatility expansion (looser than AND, more trades).
  const confirmed = volConfirmed || volExpanding;

  const level = donHigh(2, 20);
  const brokeOut = prevClose > level;

  ctx.watch([{ side: 'buy', price: level, trigger: 'above', note: 'Donchian breakout' }]);
  if (uptrend && brokeOut && confirmed) {
    ctx.state.stop = price - 3 * atrNow;
    const qty = (ctx.cash / price) * 0.99;
    return { side: 'buy', qty };
  }
  return null;
}
