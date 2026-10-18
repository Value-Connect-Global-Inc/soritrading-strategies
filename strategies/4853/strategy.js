/*
 * @coinsori-strategy v1
 * name: CryptoTrendBasket1d v3 (25% cap champion)
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: a single-coin trend strategy keeps failing because it exits the bull too early
 * or re-enters on noise. This spreads the same trend idea across four coins (BTC, ETH, SOL, BNB),
 * each capped at 25% of the account, and confirms the entry on TWO time scales — 30d and 90d — so a
 * shallow pullback inside a real bull re-enters sooner while a bear with a lagging 90d trend stays out.
 * When it buys and sells: each coin independently buys when 30-day momentum is > 0.5% AND the 90-day
 * trend is still up (price above its level 90 days ago). It sells when 30-day momentum turns clearly
 * negative (< -3%, looser than the -2% base so winners run longer) or price falls 3x ATR below its own
 * highest close since entry. Cash stays for coins not trending.
 * When it does NOT work: in a broad bear all four momentum filters are negative so the basket sits in
 * cash (safe, no profit). A coin that grinds up slowly then reverses hard gives back part of the gain
 * to the trailing stop. The looser exit keeps positions in longer, so a slow bleed costs more.
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
    const qty = (ctx.cash / px) * 0.25; // cap each coin at 25% of the account
    if (qty <= 0) return null;
    st.peak[sym] = px;
    return { side: 'buy', qty: qty };
  }
  return null;
}
