/*
 * @coinsori-strategy v1
 * name: ADA Donchian 55/10 BearSized Cool10 Vol1.2 1D
 * ex: binance
 * syms: ADAUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The ADA Donchian 55/10 champion loses to whipsaw breakouts in ranges. The
 * ledger notes that any filter using only the breakout bar itself is redundant — a filter must use
 * another data axis. Volume is that axis: a genuine breakout is driven by expanding participation,
 * a fake one often happens on thin volume. 1.5x volume confirmation hurt the 2018-21 bull (+814 vs
 * +1148) by skipping too many real breakouts, so this version relaxes the threshold to 1.2x: still
 * filters the thinnest low-conviction pokes, but lets most genuine breakouts through. A-priori
 * reason: volume confirms intent, but the bar must be judged against a threshold that does not
 * exclude normal trend starts.
 * When it buys and sells: Buys when a closed bar closes above the highest 55 bars on at least 1.2x
 * average volume, unless within 10 bars of a stop-out. Sells when a closed bar closes below the
 * lowest 10 bars. Position is half size below the 200-day average, quarter size when more than 20%
 * below it.
 * When it does NOT work: A genuine trend that starts quietly is skipped until a high-volume bar
 * appears, entering later at a higher price. A long range still loses, just less. A violent crash
 * gaps through any stop.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const closes = ctx.closes;
  const n = closes.length;
  if (n < 60) return null;

  const prevClose = closes.at(-2);
  if (prevClose == null) return null;

  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0) return null;

  const sma200 = ctx.sma(200, 1);
  // Size tiers by how far below the 200-day trend price is. Deeper = stronger downtrend = bet less.
  let sizeMult = 1.0;
  if (sma200 != null) {
    if (prevClose < sma200) sizeMult = 0.5;             // mild bear: half size
    if (prevClose < sma200 * 0.8) sizeMult = 0.25;      // deep bear (>20% below trend): quarter size
  }

  const pos = ctx.position;

  if (pos > 0) {
    const entry = ctx.entryPx || price;
    const channelLow = Math.min(...closes.slice(-12, -2));
    const exited = prevClose < channelLow || price < entry - 2 * atr;
    ctx.watch([{ side: 'sell', price: entry - 2 * atr, trigger: 'below', note: '2 ATR stop' }]);
    if (exited) {
      ctx.state.coolUntil = ctx.i + 10;                 // longer pause: skip the next failed breakout after a whipsaw
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  const channelHigh = Math.max(...closes.slice(-57, -2));
  const breakout = prevClose > channelHigh;
  // Volume confirmation: the breakout bar must trade at least 1.2x its 20-day average volume.
  // 1.5x skipped too many real bull breakouts (W1 +814 vs +1148); 1.2x only filters the thinnest pokes.
  const avgVol = ctx.avgVol(20);
  const volOk = avgVol != null && avgVol > 0 && ctx.volPrev > avgVol * 1.2;
  if (breakout && volOk && ctx.i >= (ctx.state.coolUntil || 0)) {
    ctx.watch([{ side: 'sell', price: price - 2 * atr, trigger: 'below', note: '2 ATR stop' }]);
    return { side: 'buy', qty: ((ctx.cash / price) * 0.99 * sizeMult) };
  }
  return null;
}
