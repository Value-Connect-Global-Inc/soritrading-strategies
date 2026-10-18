/*
 * @coinsori-strategy v1
 * name: CryptoTrendBasket1d v3 (33% cap test)
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: the v3 basket (30d momentum + 90d trend entry, -3% momentum exit, 3x ATR trail)
 * is robust but under-captures bulls: each coin is capped at 25% of REMAINING cash, so even when all
 * four coins trend together the basket is only ~68% invested. A 33% cap is a middle ground — more bull
 * participation than v3 but less concentrated than the 40% cap that hurt the holdout risk-adjusted.
 * When it buys and sells: each coin independently buys when 30-day momentum is > 0.5% AND the 90-day
 * trend is still up (price above its level 90 days ago). It sells when 30-day momentum turns clearly
 * negative (< -3%) or price falls 3x ATR below its own highest close since entry.
 * When it does NOT work: in a broad bear all four momentum filters are negative so the basket sits in
 * cash (safe, no profit). A larger cap means a single coin's drawdown hits the account harder than v3.
 */
function onUpdate(ctx) {
  const sym = ctx.sym;
  const px = ctx.closes.at(-2); // last CLOSED bar so backtest, paper and live agree
  if (px == null) return null;
  const mom30 = ctx.change(30, 1); // 30-day momentum on closed bars
  const mom90 = ctx.change(90, 1); // 90-day trend on closed bars — regime confirmation
  const atr = ctx.atr(14, 1);
  if (mom30 == null || mom90 == null || atr == null || atr <= 0) return null;
  const momLevel = px / (1 + mom30); // the close 30 days ago

  const pos = ctx.pos(sym);
  const st = ctx.state;
  if (!st.peak) st.peak = {}; // ctx is shared across all symbols — keep per-symbol peak
  const peak = st.peak[sym] != null ? Math.max(st.peak[sym], px) : px;
  st.peak[sym] = peak;
  const trailStop = peak - 3 * atr; // 3 ATR below the peak = let winners run, cut reversals

  if (pos > 0) {
    ctx.watch([{ side: 'sell', price: trailStop, trigger: 'below', note: '3x ATR trail' },
               { side: 'sell', price: momLevel * 0.97, trigger: 'below', note: '30d momentum < -3%' }]);
    if (mom30 < -0.03 || px < trailStop) { // exit only on a clear trend loss, not a tiny flip
      st.peak[sym] = null;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  ctx.watch([{ side: 'buy', price: momLevel * 1.005, trigger: 'above', note: '30d mom > 0.5% & 90d up' }]);
  if (mom30 > 0.005 && mom90 > 0) { // two timescales confirm a trend, not a noise blip
    const qty = (ctx.cash / px) * 0.33; // cap each coin at 33% — middle ground between 25% and 40%
    if (qty <= 0) return null;
    st.peak[sym] = px;
    return { side: 'buy', qty: qty };
  }
  return null;
}
