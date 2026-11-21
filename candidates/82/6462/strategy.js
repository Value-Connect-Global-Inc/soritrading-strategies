/*
 * @coinsori-strategy v1
 * name: BTC Volume-Confirmed Donchian Breakout 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Breakouts that arrive with well above-average volume are more often the start of a real trend than low-volume noise, so a volume filter removes most fake breakouts.
 * When it buys and sells: Buys when price closes above the 20-bar high while volume is at least 1.5x its 50-bar average and price is above the 200-bar average (uptrend). Sells when price closes below the 20-bar low or drops 2.5x ATR below entry.
 * When it does NOT work: In long sideways ranges it buys fake breakouts and is stopped out repeatedly, and it misses strong uptrends that begin below the 200-bar average.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const pos = ctx.position;
  const closes = ctx.closes;
  const highs = ctx.highs;
  const lows = ctx.lows;
  const volumes = ctx.volumes;

  if (closes.length < 60 || highs.length < 60 || lows.length < 60 || volumes.length < 60) {
    ctx.watch([]);
    return null;
  }

  const prevClose = closes.at(-2);
  const prevClose2 = closes.at(-3);

  // 20-bar channel highs/lows computed from explicit arrays (closed bars only, no ambiguity)
  const chHighPrev = Math.max(...highs.slice(-22, -2)); // 20 highs ending 2 bars ago
  const chLowPrev = Math.min(...lows.slice(-22, -2));   // 20 lows ending 2 bars ago
  const chLowLast = Math.min(...lows.slice(-21, -1));   // 20 lows ending last closed bar

  // volume: last closed bar vs its own 50-bar average (self-computed)
  const volPrev = volumes.at(-2);
  const volWindow = volumes.slice(-51, -1);
  const avgVol = volWindow.reduce((a, b) => a + b, 0) / volWindow.length;

  const sma200 = ctx.sma(200, 1);
  const atr = ctx.atr(14, 1);
  if (sma200 == null || atr == null || avgVol <= 0) {
    ctx.watch([]);
    return null;
  }

  const watch = [];

  if (pos <= 0) {
    // entry: closed-bar breakout above the 20-bar high, confirmed by volume
    const brokeOut = prevClose2 <= chHighPrev && prevClose > chHighPrev;
    const volOk = volPrev > avgVol * 1.5; // volume filter: only trade real (high-volume) breakouts
    const trendOk = prevClose > sma200;   // uptrend regime filter
    watch.push({ side: 'buy', price: chHighPrev, trigger: 'above', note: 'DC20 breakout + vol', conds: [
      { label: 'Vol>1.5x avg', ok: volOk },
      { label: 'Close>SMA200', ok: trendOk }
    ]});
    ctx.watch(watch);
    if (brokeOut && volOk && trendOk) {
      const qty = ctx.cash / price * 0.9; // keep 10% cash buffer for fees/slippage
      return { side: 'buy', qty };
    }
    return null;
  }

  // in position: exits
  const entryPx = ctx.entryPx;
  let stop = null;
  if (entryPx != null) stop = entryPx - 2.5 * atr; // hard stop: 2.5x ATR below entry

  if (stop != null) watch.push({ side: 'sell', price: stop, trigger: 'below', note: 'ATR hard stop' });
  watch.push({ side: 'sell', price: chLowLast, trigger: 'below', note: 'DC20 low exit' });
  ctx.watch(watch);

  const lowBreak = prevClose2 >= chLowPrev && prevClose < chLowPrev; // closed-bar break below 20-bar low
  if (lowBreak) return { side: 'sell', qty: pos, reduceOnly: true };
  if (stop != null && price <= stop) return { side: 'sell', qty: pos, reduceOnly: true };
  return null;
}
