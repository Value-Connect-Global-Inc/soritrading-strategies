/*
 * @coinsori-strategy v1
 * name: CryptoTrendBasket1d v5 (faster entry)
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: the champion's 30d momentum entry is slow — by the time 30d momentum
 * turns positive the move is already under way, so the basket misses the early leg of every
 * bull. This version keeps the champion's proven -3% momentum exit and 3x ATR trailing stop
 * but enters on a faster 20d momentum (still confirmed by the 90d trend filter), so it is
 * quicker to catch a rally and no more exposed to a bear (the 90d filter still gates it out).
 * When it buys and sells: each coin independently buys when 20-day momentum is > 0.5% AND the
 * 90-day trend is still up. It sells when 30-day momentum turns clearly negative (< -3%) or
 * price falls 3x ATR below its own highest close since entry.
 * When it does NOT work: a faster entry is noisier in a choppy range — it can trigger a few
 * extra whipsaws near the 0.5% band, costing fees. In a slow grind-down where 90d stays up
 * but price drifts, the -3% momentum exit still cuts reasonably. A sudden crash with no
 * prior momentum is caught only by the 3x ATR trail.
 */
function onUpdate(ctx) {
  const sym = ctx.sym;
  const px = ctx.closes.at(-2); // last CLOSED bar so backtest, paper and live agree
  if (px == null) return null;
  const mom20 = ctx.change(20, 1); // faster entry momentum
  const mom30 = ctx.change(30, 1); // exit momentum (kept from champion)
  const mom90 = ctx.change(90, 1); // 90-day trend on closed bars — regime confirmation
  const atr = ctx.atr(14, 1);
  if (mom20 == null || mom30 == null || mom90 == null || atr == null || atr <= 0) return null;
  const momLevel30 = px / (1 + mom30); // the close 30 days ago

  const pos = ctx.pos(sym);
  const st = ctx.state;
  if (!st.peak) st.peak = {}; // ctx.state is shared across symbols — keep per-symbol peak
  const peak = st.peak[sym] != null ? Math.max(st.peak[sym], px) : px;
  st.peak[sym] = peak;
  const trailStop = peak - 3 * atr; // 3 ATR below the peak = let winners run, cut reversals

  if (pos > 0) {
    ctx.watch([{ side: 'sell', price: trailStop, trigger: 'below', note: '3x ATR trail' },
               { side: 'sell', price: momLevel30 * 0.97, trigger: 'below', note: '30d momentum < -3%' }]);
    if (mom30 < -0.03 || px < trailStop) { // champion exit unchanged
      st.peak[sym] = null;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  ctx.watch([{ side: 'buy', price: px / (1 + mom20) * 1.005, trigger: 'above', note: '20d mom > 0.5% & 90d up' }]);
  if (mom20 > 0.005 && mom90 > 0) { // faster entry, still gated by 90d trend
    const qty = (ctx.cash / px) * 0.25; // cap each coin at 25% of the account
    if (qty <= 0) return null;
    st.peak[sym] = px;
    return { side: 'buy', qty: qty };
  }
  return null;
}
