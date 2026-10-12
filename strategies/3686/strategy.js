/*
 * @coinsori-strategy v1
 * name: DonchianTrendMomentumGate
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: the multi-asset Donchian breakout system is the validated
 * champion, but it buys every 55-day high including those at the very top of an
 * exhausted move. Adding a trend gate (price above its 200-day average) and an
 * overbought gate (RSI below 80) keeps only breakouts that occur inside an
 * uptrend that still has room to run.
 * When it buys and sells: buy when a close is a new 55-day high AND price is
 * above the 200-day average AND RSI(14) close is below 80; sell on a 20-day low
 * or a 2x ATR stop below entry. Each asset trades a 25% leg.
 * When it does NOT work: in a bear where price stays below the 200-day average
 * it never trades (safe but no profit); in a sideways chop with price above the
 * 200-day it still whipsaws like the base system, just less often. The RSI<80
 * gate can still keep it out of the very hottest part of a melt-up.
 */
function onUpdate(ctx) {
  const sym = ctx.sym;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) { ctx.watch([]); return null; }
  const entryHigh = ctx.high(55, 2); // 55-bar high, 2 bars back (excludes last closed bar)
  const exitLow = ctx.low(20, 2);     // 20-bar low, 2 bars back (excludes last closed bar)
  const atr = ctx.atr(14, 1);
  const sma200 = ctx.sma(200, 1);
  const rsi = ctx.rsi(14, 1);
  if (entryHigh == null || exitLow == null || atr == null || atr <= 0 || sma200 == null || rsi == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) { ctx.watch([]); return null; }

  const pos = ctx.pos(sym);
  const legQty = (ctx.cash / price) * 0.25; // 25% of equity per leg, 4 legs = full book

  if (pos > 0) {
    const hardStop = ctx.entryPx - 2 * atr;
    if (price <= hardStop || prevClose < exitLow) {
      ctx.watch([]);
      return { side: 'sell', qty: pos };
    }
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2x ATR stop' }]);
    return null;
  }

  // Regime gate: only breakouts inside an uptrend (price>200d) that is not
  // over-extended. RSI cap at 80 (not 75) so the gate filters only true vertical
  // exhaustion, not normal strong-trend RSI that still has room to run.
  if (prevClose > entryHigh && prevClose > sma200 && rsi < 80) {
    ctx.watch([]);
    return { side: 'buy', qty: legQty };
  }
  ctx.watch([{ side: 'buy', price: entryHigh, trigger: 'above', note: '55d breakout entry',
               conds: [{ label: 'close>200d', ok: prevClose > sma200 }, { label: 'RSI(14) close', now: rsi, op: '<', ref: 80, closed: true }] }]);
  return null;
}
