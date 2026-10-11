/*
 * @coinsori-strategy v1
 * name: BTC VWAP Mean-Reversion 1H
 * ex: binance
 * syms: BTCUSDT
 * interval: 1h
 * cash: 10000
 *
 * Why this strategy: Mean reversion toward the volume-weighted average price (VWAP).
 * When price stretches far below the volume-weighted mean on heavy selling, buyers
 * step back in — a different signal family from the Donchian/Ichimoku trend
 * followers, so it diversifies the account and works in the sideways chop that
 * kills breakout strategies. Only trades inside a rising 200-hour average so it
 * does not catch falling knives in a bear.
 * When it buys and sells: buys when price closes below VWAP minus 1.5 standard
 * deviations AND price is above a rising 200-hour average AND RSI(14) < 40. Sells
 * when price closes back at or above VWAP (the mean-reversion target), or price
 * falls 2.5 ATR below entry.
 * When it does NOT work: In a strong one-way bull, price never stretches far below
 * VWAP so it trades rarely and lags buy-and-hold. In a violent crash it keeps
 * buying the dip that keeps dipping. A rising 200-hour gate keeps capital safe in
 * a bear but means it misses the first leg of a V-reversal.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const closes = ctx.closes;
  const volumes = ctx.volumes;
  const n = closes.length;
  if (n < 220) return null;
  const prevClose = closes.at(-2);
  if (prevClose == null) return null;

  const atr = ctx.atr(14, 1);
  const rsi = ctx.rsi(14, 1);
  const sma200 = ctx.sma(200, 1);
  const sma200prev = ctx.sma(200, 2);
  if (atr == null || atr <= 0 || rsi == null || sma200 == null || sma200prev == null) return null;

  // Rolling VWAP over the last 24 closed bars (1 day of 1h bars).
  const W = 24;
  let pv = 0, vsum = 0;
  for (let k = 1; k <= W; k++) {
    const c = closes.at(-1 - k);
    const v = volumes.at(-1 - k);
    if (c == null || v == null || v <= 0) return null;
    pv += c * v;
    vsum += v;
  }
  const vwap = pv / vsum;
  if (!Number.isFinite(vwap) || vwap <= 0) return null;

  // Standard deviation of closes around VWAP over the same window.
  let ss = 0;
  for (let k = 1; k <= W; k++) {
    const c = closes.at(-1 - k);
    if (c == null) return null;
    ss += (c - vwap) * (c - vwap);
  }
  const sd = Math.sqrt(ss / W);

  const uptrend = sma200 > sma200prev;   // only buy in a rising 200h regime
  const pos = ctx.position;

  if (pos > 0) {
    const entry = ctx.entryPx || price;
    const stop = entry - 2.5 * atr;
    ctx.watch([{ side: 'sell', price: vwap, trigger: 'above', note: 'VWAP reversion target' },
               { side: 'sell', price: stop, trigger: 'below', note: '2.5 ATR stop' }]);
    if (prevClose >= vwap || price < stop) return { side: 'sell', qty: pos };
    return null;
  }

  // Buy only a deep, volume-weighted discount, inside an uptrend, with RSI confirming the dip.
  if (uptrend && prevClose < vwap - 1.5 * sd && rsi < 40) {
    ctx.watch([{ side: 'sell', price: price - 2.5 * atr, trigger: 'below', note: '2.5 ATR stop' }]);
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  return null;
}
