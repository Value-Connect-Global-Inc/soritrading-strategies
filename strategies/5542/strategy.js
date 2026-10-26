/*
 * @coinsori-strategy v1
 * name: Crypto Relative-Strength Rotation 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: In crypto, relative strength rotates — capital flows into the strongest asset of a basket and leaves the laggards. Holding the strongest of BTC/ETH/SOL/BNB by 30-day momentum captures those flows instead of betting on one coin.
 * When it buys and sells: Each day, compare 30-day returns across the 4 coins. Hold the one with the highest return, but only if it is positive (else hold cash). Sell when another coin overtakes it by a margin or a hard stop is hit.
 * When it does NOT work: In a broad coordinated crypto bear, all coins have negative momentum so the strategy sits in cash (safe but no upside). In choppy rotation where leadership flips every few days, the margin filter limits whipsaw but some churn remains.
 */
function onUpdate(ctx) {
  const sym = ctx.sym;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  // 30-day momentum of THIS symbol from CLOSED bars (no look-ahead).
  const closes = ctx.closes;
  if (closes == null || closes.length < 40) return null;
  const cur = closes.at(-2);
  const prev = closes.at(-32);
  if (cur == null || prev == null || prev <= 0) return null;
  const myRet = cur / prev - 1;

  // Store this symbol's return for the other symbols to read on their turn.
  // ctx.state is SHARED across all symbols in the basket (proven pattern from the MR basket).
  if (ctx.state.ret == null) ctx.state.ret = {};
  ctx.state.ret[sym] = myRet;

  // Best return among the OTHER symbols, from their last stored bar (one bar stale = safe).
  let bestOther = -Infinity;
  const syms = ctx.syms || [sym];
  for (const s of syms) {
    if (s === sym) continue;
    const r = ctx.state.ret[s];
    if (r != null && Number.isFinite(r)) bestOther = Math.max(bestOther, r);
  }

  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0) return null;
  const pos = ctx.pos(sym);

  // --- Hard stop: exit if price falls 2.5x ATR below entry (protect capital in any regime).
  if (pos > 0) {
    const entry = ctx.entryPx;
    if (entry != null) {
      const stop = entry - 2.5 * atr;
      ctx.watch([{ side:'sell', price: stop, trigger:'below', note:'hard stop 2.5x ATR' }]);
      if (price <= stop) {
        return { side:'sell', qty: pos, reduceOnly: true };
      }
    }
    // --- Rotation exit: another coin is now clearly stronger (2pp margin = avoid whipsaw).
    if (bestOther - myRet > 0.02) {
      return { side:'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  // --- Entry: this coin is the strongest (beats best other by 2pp) AND momentum is positive.
  // Margin 0.02 prevents overtrading on tiny noisy differences; positive filter = cash in bears.
  if (myRet > 0 && myRet - bestOther > 0.02) {
    ctx.watch([{ side:'buy', note:'strongest of basket & momentum>0' }]);
    return { side:'buy', qty: ctx.cash / price * 0.99 };
  }

  ctx.watch([{ side:'buy', note:'waiting to be strongest of basket' }]);
  return null;
}
