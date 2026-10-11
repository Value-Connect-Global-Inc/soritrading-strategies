/*
 * @coinsori-strategy v1
 * name: Defensive Mean Reversion BTC 4h
 * ex: upbit
 * syms: BTC
 * interval: 4h
 * cash: 10000000
 *
 * Why this strategy: BTC tends to snap back up after sharp, oversold flush drops when
 * the long-term trend is still intact. Buying those panic dips and selling after a
 * recovery is a defensive way to profit without chasing melt-ups.
 * When it buys and sells: it buys only when price is far below its long-term (200-day)
 * average AND RSI is very oversold (deep dip). It sells once price climbs back above its
 * short average (recovered) or when the long-term trend turns down.
 * When it does NOT work: in a long melt-up it stays mostly flat (few dips to buy) and
 * lags buy-and-hold; in a sustained bear market the trend gate keeps it mostly in cash
 * so it protects capital but makes little. It is defensive, not a momentum winner.
 *
 * 2026-04-26 표시만 바뀜, 매매 판단은 그대로
 */

function onUpdate(ctx) {
  // ---- trend gate on 4h: 1200 bars ~ 200 days, matching the validated 1d recipe ----
  const smaLong = ctx.sma(1200, 1);
  if (smaLong == null) return null;
  const price = ctx.price;

  const bb = ctx.bb(20, 2, 1);
  const rsi = ctx.rsi(14, 1);
  const ema20 = ctx.ema(20, 1);
  if (bb == null || rsi == null || ema20 == null) return null;

  const pos = ctx.position;

  if (pos > 0) {
    // Exit when recovered above short average, or long-term trend broke down.
    ctx.watch([
      { side: 'sell', price: smaLong, trigger: 'below', note: 'trend breakdown exit' },
      { side: 'sell', price: ema20, trigger: 'above', note: 'recovered above EMA20' }
    ]);
    if (price < smaLong || price > ema20) {
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  // ---- entry: deep oversold flush while long-term trend is rising ----
  const smaLongPrev = ctx.sma(1200, 2);
  if (smaLongPrev == null) return null;
  const trendUp = smaLong > smaLongPrev && price > smaLong * 0.85;

  ctx.watch([
    { side: 'buy', price: bb.lower, trigger: 'below', note: 'BB lower touch',
      conds: [
        { label: 'SMA1200 rising & price > 0.85*SMA', ok: trendUp },
        { label: 'RSI(14) close', now: rsi, op: '<', ref: 30, closed: true }
      ] }
  ]);

  if (trendUp && rsi < 30 && price < bb.lower) {
    return { side: 'buy', qty: (ctx.cash / price) * 0.98 };
  }

  return null;
}
