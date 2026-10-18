/*
 * @coinsori-strategy v1
 * name: CryptoTrendBasket1d
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: single-coin trend strategies keep failing because they exit the bull too early.
 * This spreads the same trend idea across four coins — BTC, ETH, SOL, BNB — so when any of them is
 * trending up we are invested in it, and each position is capped at 25% of the account so no single
 * coin can ruin the portfolio. A wide trailing stop lets winners run through the whole bull.
 * When it buys and sells: each coin independently buys when its 30-day momentum is positive (price
 * above its level 30 days ago) and sells when momentum turns clearly negative or price falls 3x ATR
 * below its own highest close since entry. Capital sits in cash for coins that are not trending.
 * When it does NOT work: in a broad bear market all four momentum filters are negative, so the
 * basket sits mostly in cash (safe, but no profit). A coin that grinds up slowly then reverses hard
 * gives back part of the gain to the trailing stop. Fees add up if momentum flips often.
 */
function onUpdate(ctx) {
  const sym = ctx.sym;
  const px = ctx.closes.at(-2); // last CLOSED bar so backtest, paper and live agree
  if (px == null) return null;
  const mom30 = ctx.change(30, 1); // 30-day momentum on closed bars
  const atr = ctx.atr(14, 1);
  if (mom30 == null || atr == null || atr <= 0) return null;

  const pos = ctx.pos(sym);
  const st = ctx.state;
  if (!st.peak) st.peak = {}; // ctx is shared across all symbols — keep per-symbol peak
  const peak = st.peak[sym] != null ? Math.max(st.peak[sym], px) : px;
  st.peak[sym] = peak;
  const trailStop = peak - 3 * atr; // 3 ATR below the peak = let winners run, cut reversals

  if (pos > 0) {
    if (mom30 < -0.02 || px < trailStop) { // exit only on a clear trend loss, not a tiny flip
      st.peak[sym] = null;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  if (mom30 > 0.02) { // require a clear positive trend before entering, avoids noise flips
    const qty = (ctx.cash / px) * 0.25; // cap each coin at 25% of the account
    if (qty <= 0) return null;
    st.peak[sym] = px;
    return { side: 'buy', qty: qty };
  }
  return null;
}
