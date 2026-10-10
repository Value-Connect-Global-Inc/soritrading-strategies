/*
 * @coinsori-strategy v1
 * name: BTC Fear Greed Capitulation 1D
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The Crypto Fear & Greed Index measures crowd emotion. When it hits
 * extreme fear (sub-20) inside a bull market, sellers are exhausted and the dip is a
 * discount; when greed returns, the bounce is done. This is a sentiment signal — a
 * completely different data source than the price-only RSI2 champion.
 * When it buys and sells: Buys BTC when the Fear & Greed index is at or below 20 AND price
 * is above the 200-day average (a panic dip inside an uptrend). Sells when the index
 * recovers to 50 (neutral), after 30 days, or on a 15% stop. After any exit it waits 10
 * days before buying again.
 * When it does NOT work: In a bear market the index can sit at extreme fear for months —
 * the 200-day filter is what stops it from buying falling knives. In a long sideways
 * market with no extreme fear it rarely trades and lags buy-and-hold. No sentiment data
 * before Feb 2018.
 */

function onUpdate(ctx) {
  const fg = ctx.data('fear_greed');
  const price = ctx.price;
  const sma200 = ctx.sma(200, 1);
  if (fg == null || price == null || sma200 == null) return null;

  const st = ctx.state;
  const pos = ctx.position;

  if (pos <= 0) {
    // Cooldown: fear days come in clusters; re-buying every one bleeds fees and risk.
    if (st.cooldownUntil != null && ctx.i < st.cooldownUntil) return null;
    // Extreme fear (<=20 is the classic "extreme fear" band) + uptrend = capitulation dip.
    // The SMA200 filter is what separates a buyable panic from a bear-market falling knife.
    if (fg <= 20 && price > sma200) {
      st.entryBar = ctx.i;
      st.entryPx = price;
      ctx.watch([{ side: 'sell', price: price * 0.85, trigger: 'below', note: '15% stop' }]);
      return { side: 'buy', qty: (ctx.cash / price) * 0.9 };
    }
    return null;
  }

  const entry = st.entryPx || price;
  const barsHeld = ctx.i - (st.entryBar || ctx.i);
  const stopped = price <= entry * 0.85;
  ctx.watch([{ side: 'sell', price: entry * 0.85, trigger: 'below', note: '15% stop' }]);
  // Exit when sentiment normalizes (index >= 50 = back to neutral), on the stop, or after
  // 30 days — a panic bounce should complete within a month or it was a new downtrend.
  if (fg >= 50 || stopped || barsHeld >= 30) {
    st.cooldownUntil = ctx.i + 10;
    return { side: 'sell', qty: pos };
  }
  return null;
}
