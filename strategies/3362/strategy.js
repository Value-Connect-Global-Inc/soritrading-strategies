/*
 * @coinsori-strategy v1
 * name: BTC SMA200 Regime Trend 1D
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: BTC's long-term trends are the cleanest in crypto — the 200-day average
 * separates bull from bear better than on SOL. This holds BTC while the daily close is above
 * the 200-day average and moves to cash below it. It is a different asset and a different
 * family from the SOL RSI2 panic-dip champion, so the two are not redundant.
 * When it buys and sells: Buys when the daily close rises above the 200-day average. Sells when
 * the daily close falls below the 200-day average or when price falls 25% below the highest
 * close since entry (trailing stop that caps a crash).
 * When it does NOT work: In a long sideways market it whipsaws around the line and bleeds fees.
 * It gives back a large part of every peak before the line confirms a top.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const sma200 = ctx.sma(200, 1);
  const lastClose = ctx.closes.at(-2);
  if (sma200 == null || lastClose == null) return null;

  const st = ctx.state;
  const pos = ctx.position;

  if (pos > 0) {
    if (st.peak == null || lastClose > st.peak) st.peak = lastClose;
    const trail = st.peak * 0.75;  // 25% trail from the highest close since entry
    ctx.watch([{ side: 'sell', price: trail, trigger: 'below', note: '25% trail' }]);
    if (lastClose < sma200 || price <= trail) {
      st.peak = null;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  if (lastClose > sma200) {
    st.entryPx = price;
    st.peak = lastClose;
    const qty = (ctx.cash / price) * 0.95;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
