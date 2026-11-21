/*
 * @coinsori-strategy v1
 * name: BTC Volume-Confirmed Donchian Breakout 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Breakouts that arrive with well above-average volume are more often the start of a real trend than low-volume noise, so a volume filter removes most fake breakouts.
 * When it buys and sells: Buys when price closes above the 20-bar high while volume is at least 1.5x its 50-bar average and price is above the 200-bar average (uptrend). Exits when price falls 3x ATR below the highest high reached since entry (chandelier trailing stop), or 2.5x ATR below entry as an initial hard stop.
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

  // 20-bar channel highs/lows from explicit arrays (closed bars only, no ambiguity)
  const chHighPrev = Math.max(...highs.slice(-22, -2)); // 20 highs ending 2 bars ago
  const chLowPrev = Math.min(...lows.slice(-22, -2));   // 20 lows ending 2 bars ago

  // volume: last closed bar vs its own 50-bar average
  const volPrev = volumes.at(-2);
  const volWindow = volumes.slice(-51, -1);
  const avgVol = volWindow.reduce((a, b) => a + b, 0) / volWindow.length;

  const sma200 = ctx.sma(200, 1);
  const atr = ctx.atr(14, 1);
  if (sma200 == null || atr == null || avgVol <= 0) {
    ctx.watch([]);
    return null;
  }

  if (pos <= 0) {
    // entry: closed-bar breakout above the 20-bar high, confirmed by volume
    const brokeOut = prevClose2 <= chHighPrev && prevClose > chHighPrev;
    const volOk = volPrev > avgVol * 1.5; // volume filter: only trade real (high-volume) breakouts
    const trendOk = prevClose > sma200;   // uptrend regime filter
    ctx.watch([{ side: 'buy', price: chHighPrev, trigger: 'above', note: 'DC20 breakout + vol', conds: [
      { label: 'Vol>1.5x avg', ok: volOk },
      { label: 'Close>SMA200', ok: trendOk }
    ]}]);
    if (brokeOut && volOk && trendOk) {
      const qty = ctx.cash / price * 0.9; // keep 10% cash buffer for fees/slippage
      return { side: 'buy', qty };
    }
    return null;
  }

  // in position: chandelier trailing stop
  // highest high reached since entry, kept in ctx.state so it survives restarts
  let hi = (typeof ctx.state.hiSinceEntry === 'number') ? ctx.state.hiSinceEntry : 0;
  if (price > hi) hi = price;
  ctx.state.hiSinceEntry = hi;

  const entryPx = ctx.entryPx;
  let stop = hi - 3 * atr; // chandelier: trail 3x ATR below the highest high (wide enough to ride trends)
  if (entryPx != null) {
    stop = Math.max(stop, entryPx - 2.5 * atr); // initial hard stop until the trail rises above it
  }

  ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: 'chandelier stop 3xATR' }]);
  if (price <= stop) {
    return { side: 'sell', qty: pos, reduceOnly: true };
  }
  return null;
}
