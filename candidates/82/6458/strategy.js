/*
 * @coinsori-strategy v1
 * name: SOL Trend-Follow EMA200 4H
 * ex: binance
 * syms: SOL/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: SOL is far more volatile than BTC, so its bear markets are
 * brutal (it fell ~95% in 2022) but its bull runs are explosive. Riding the
 * trend when it is clearly up and stepping out when it breaks gives most of the
 * upside with a much smaller drawdown than holding through the crashes.
 * When it buys and sells: buy when SOL closes more than 1.5% above its 200-EMA
 * (4h, ~33 days) while that EMA is rising — a confirmed uptrend. Sell when
 * price closes more than 1.5% below the EMA (the trend is breaking).
 * When it does NOT work: in a long sideways chop around the EMA it pays fees on
 * whipsaws; and it gives up part of a straight melt-up because it only enters
 * after a clear breakout above the trend line.
 */
function onUpdate(ctx) {
  const ema200 = ctx.ema(200, 1);
  const ema200prev = ctx.ema(200, 2);
  if (ema200 == null || ema200prev == null) {
    ctx.watch([]);
    return null;
  }

  const price = ctx.price;
  const pos = ctx.position || 0;
  const prevClose = ctx.closes.at(-2);
  // Asymmetric bands: enter only on a clear breakout (1.5% above), exit early
  // (1.5% below) so we leave before a crash fully develops.
  const rising = ema200 > ema200prev;
  const aboveBand = prevClose != null && prevClose > ema200 * 1.015;
  const belowBand = prevClose != null && prevClose < ema200 * 0.985;

  if (pos > 0) {
    ctx.watch([{ side: 'sell', price: ema200 * 0.985, trigger: 'below', note: 'close < EMA200 band' }]);
    if (belowBand) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  ctx.watch([{ side: 'buy', price: ema200 * 1.015, trigger: 'above', note: 'close above EMA200+1.5% + rising', conds: [{ label: 'EMA200 rising', ok: rising }] }]);
  if (aboveBand && rising) {
    return { side: 'buy', qty: (ctx.cash / price) * 0.95 };
  }
  return null;
}
