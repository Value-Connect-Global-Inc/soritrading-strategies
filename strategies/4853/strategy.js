/*
 * @coinsori-strategy v1
 * name: CryptoTrendBasket1d v4 (90d trend-break exit)
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: the 30-day momentum exit was shaking the basket out of every
 * pullback, so it captured only a fraction of the bull. This version keeps the same
 * two-time-scale entry (30d momentum > 0.5% AND 90d trend up) but exits only when the
 * 90-day trend actually breaks OR price falls 3x ATR below its own peak — i.e. it rides
 * the whole bull and no longer sells on a mere 30-day dip.
 * When it buys and sells: each coin independently buys when 30-day momentum is > 0.5%
 * AND the 90-day trend is still up. It sells when the 90-day trend turns down (price
 * below its level 90 days ago) or price falls 3x ATR below its own highest close since entry.
 * When it does NOT work: in a long slow bleed where 90d trend stays up but price grinds
 * lower, it holds the whole way down — the 3x ATR trail is the only defense and it is wide.
 * In a fast crash it still cuts with the ATR trail. A choppy sideways market triggers
 * repeated entries and exits at the 0.5% band, costing fees.
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
  if (!st.peak) st.peak = {}; // ctx.state is shared across symbols — keep per-symbol peak
  const peak = st.peak[sym] != null ? Math.max(st.peak[sym], px) : px;
  st.peak[sym] = peak;
  const trailStop = peak - 3 * atr; // 3 ATR below the peak = crash protection, not a tight stop

  if (pos > 0) {
    ctx.watch([{ side: 'sell', price: trailStop, trigger: 'below', note: '3x ATR trail' },
               { side: 'sell', price: px / (1 + mom90), trigger: 'below', note: '90d trend break' }]);
    const trendBreakLevel = px / (1 + mom90); // the close 90 days ago
    if (mom90 < 0 || px < trailStop) { // exit only on a real trend turn or crash
      st.peak[sym] = null;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  ctx.watch([{ side: 'buy', price: momLevel * 1.005, trigger: 'above', note: '30d mom > 0.5% & 90d up' }]);
  if (mom30 > 0.005 && mom90 > 0) { // two timescales confirm a trend, not a noise blip
    const qty = (ctx.cash / px) * 0.25; // cap each coin at 25% of the account
    if (qty <= 0) return null;
    st.peak[sym] = px;
    return { side: 'buy', qty: qty };
  }
  return null;
}
