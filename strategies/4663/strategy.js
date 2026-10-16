/*
 * @coinsori-strategy v1
 * name: BTC RSI2 Capitulation Bounce 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Sharp crashes on BTC often overshoot and snap back. RSI(2)
 * on closed 4h bars is the classic "capitulation" oscillator — when it drops to
 * extreme oversold levels, sellers are exhausted and a short-term bounce is
 * likely. This is counter-trend (mean reversion), the opposite family from the
 * breakout/regime strategies that dominated past cycles.
 * When it buys and sells: buys when the last closed 4h bar has RSI(2) <= 12
 * (extreme oversold). Sells when RSI(2) recovers to >= 60, price rises +5% from
 * entry, or price falls -4% from entry (hard stop).
 * When it does NOT work: in a sustained bear trend, oversold keeps getting more
 * oversold and the -4% stop bleeds repeatedly; it also misses all the upside of
 * strong trends because it only trades after a crash.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const c = ctx.closes;
  if (c.length < 30) return null;

  const rsi = ctx.rsi(2, 1);   // closed-bar RSI(2) — same in backtest/paper/live
  if (rsi == null) return null;

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const entry = ctx.entryPx;
    if (entry == null) return null;
    const pnl = (price - entry) / entry;
    const rsiNow = ctx.rsi(2, 1);
    if (pnl <= -0.04) return { side: 'sell', qty: pos };   // hard stop 4% — caps bear-trend bleed
    if (pnl >= 0.05) return { side: 'sell', qty: pos };    // take profit 5% — bounce is short-lived
    if (rsiNow != null && rsiNow >= 60) return { side: 'sell', qty: pos };   // RSI recovered
    ctx.watch([{ side: 'sell', price: entry * 0.96, trigger: 'below', note: '4% stop' },
               { side: 'sell', price: entry * 1.05, trigger: 'above', note: '5% target' }]);
    return null;
  }

  if (rsi <= 12) {   // extreme oversold = capitulation; 12 is the classic RSI(2) panic line
    const qty = (ctx.cash * 0.6 / price) * 0.99;   // 60% size — mean reversion is higher risk
    if (qty <= 0) return null;
    ctx.watch([{ side: 'buy', note: 'RSI(2) capitulation',
                 conds: [{ label: 'RSI(2) closed', now: rsi, op: '<=', ref: 12, closed: true }] }]);
    return { side: 'buy', qty };
  }
  return null;
}
