/*
 * @coinsori-strategy v1
 * name: BTC 1D Volume-Capitulation MR
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The validated BTC 1D mean-reversion edge (champion 3033) uses price
 * bands only. This is a different signal source — volume. A daily capitulation flush
 * (big red candle on a volume spike) marks genuine panic sellers exhausting, which
 * historically snaps back. Volume is backfilled in this environment, so it is testable.
 * When it buys and sells: Buy when price closes below its 20-day lower Bollinger, RSI<30,
 * AND today's volume is at least 1.5x the 20-day average (panic volume), only inside a rising
 * 200-day average. Sell on the snap-back above the 20-day EMA or when RSI recovers above 55.
 * When it does NOT work: In a sustained bear the rising-trend gate keeps us flat. It lags
 * buy-and-hold in a straight-line melt-up. Requiring a volume spike makes entries rarer, so
 * it can miss slow grinding declines that never spike volume.
 *
 * 2025-01-01: display only changed — added ctx.watch declarations, trading logic unchanged.
 */
function onUpdate(ctx) {
  const pos = ctx.position;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const bb = ctx.bb(20, 2.5, 1);
  const rsi = ctx.rsi(14, 1);
  const sma200 = ctx.sma(200, 1);
  const sma200prev = ctx.sma(200, 2);
  const ema20 = ctx.ema(20, 1);
  const vol = ctx.vol;              // current bar volume (ago=0)
  const avgVol = ctx.avgVol(20);    // 20-bar average volume
  if (bb == null || rsi == null || sma200 == null || sma200prev == null || ema20 == null) return null;
  if (vol == null || avgVol == null || avgVol <= 0) return null;

  const uptrend = sma200 > sma200prev;
  const lowerBand = bb.lower;

  if (pos > 0) {
    // Snap-back exit: above the 20-day EMA or once RSI recovers.
    ctx.watch([
      { side: 'sell', price: ema20, trigger: 'above', note: 'EMA20 snap-back' },
      { side: 'sell', price: 55, trigger: 'above', note: 'RSI recovery', conds: [{ label: 'RSI(14) close', now: rsi, op: '>', ref: 55, closed: true }] }
    ]);
    if (price > ema20 || rsi > 55) {
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  if (!uptrend) {
    ctx.watch([]);
    return null;
  }

  const volumeSpike = vol >= 1.5 * avgVol;   // panic volume: 1.5x the 20-day average (relaxed from 2x)
  const capitulation = price < lowerBand && rsi < 30 && volumeSpike;

  if (capitulation) {
    // Size modestly: half the cash to keep drawdown low on this rarer, higher-conviction entry.
    ctx.watch([]);
    return { side: 'buy', qty: (ctx.cash / price) * 0.5 };
  }
  ctx.watch([
    { side: 'buy', price: lowerBand, trigger: 'below', note: 'BB lower touch', conds: [
      { label: 'RSI(14) close', now: rsi, op: '<', ref: 30, closed: true },
      { label: 'Volume spike', ok: volumeSpike },
      { label: 'SMA200 rising', ok: uptrend }
    ]}
  ]);
  return null;
}
