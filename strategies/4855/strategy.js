/*
 * @coinsori-strategy v1
 * name: BasketMRPullback1d
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: the momentum champion buys strength and keeps getting shaken out of bull pullbacks
 * (holdout captured only ~1/4 of the 2024-26 bull). This is the opposite family: buy WEAKNESS inside a
 * confirmed uptrend — a coin that pulls back hard (below its lower Bollinger band with a low RSI) while
 * its 90-day trend is still up tends to snap back to the middle of the band. Exit when it reverts.
 * When it buys and sells: each coin buys when 90-day momentum is still positive (uptrend intact) AND price
 * is below the lower Bollinger band AND RSI(14) < 35 (oversold pullback). It sells when price returns to
 * the middle Bollinger band (mean reversion target) or price falls 3x ATR below its highest close since
 * entry (hard protection if the dip becomes a crash).
 * When it does NOT work: in a real bear the 90-day filter is negative so it stays out (safe, no profit).
 * A coin that keeps falling through the lower band (crashing alt) hits the 3x ATR stop repeatedly and
 * bleeds fees. Mean reversion buys falling knives when the "uptrend" was already over.
 */
function onUpdate(ctx) {
  const sym = ctx.sym;
  const px = ctx.closes.at(-2); // last CLOSED bar so backtest, paper and live agree
  if (px == null) return null;
  const mom90 = ctx.change(90, 1); // 90-day trend — only buy dips inside a bull
  const bb = ctx.bb(20, 2, 1); // Bollinger bands on closed bars
  const rsi = ctx.rsi(14, 1);
  const atr = ctx.atr(14, 1);
  if (mom90 == null || bb == null || rsi == null || atr == null || atr <= 0) return null;
  if (bb.lower == null || bb.mid == null) return null;

  const pos = ctx.pos(sym);
  const st = ctx.state;
  if (!st.peak) st.peak = {}; // per-symbol peak for the protective trailing stop
  const peak = st.peak[sym] != null ? Math.max(st.peak[sym], px) : px;
  st.peak[sym] = peak;
  const trailStop = peak - 3 * atr; // crash protection if the dip keeps going

  if (pos > 0) {
    ctx.watch([{ side: 'sell', price: bb.mid, trigger: 'above', note: 'revert to mid band' },
               { side: 'sell', price: trailStop, trigger: 'below', note: '3x ATR crash stop' }]);
    if (px >= bb.mid || px < trailStop) { // exit on reversion target OR crash stop
      st.peak[sym] = null;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  ctx.watch([{ side: 'buy', price: bb.lower, trigger: 'below', note: 'lower band oversold',
               conds: [{ label: '90d trend up', ok: mom90 > 0 }, { label: 'RSI(14) < 35', ok: rsi < 35 }] }]);
  if (mom90 > 0 && px < bb.lower && rsi < 35) { // oversold pullback inside a live uptrend
    const qty = (ctx.cash / px) * 0.25; // cap each coin at 25% of the account
    if (qty <= 0) return null;
    st.peak[sym] = px;
    return { side: 'buy', qty: qty };
  }
  return null;
}
