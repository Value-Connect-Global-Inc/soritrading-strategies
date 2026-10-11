/*
 * @coinsori-strategy v1
 * name: BTC 1D Fear-Greed Sentiment Contrarian
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Crypto sentiment is a well-documented contrarian signal — markets
 * bottom in extreme fear and top in extreme greed. The Fear & Greed index (0-100) is a
 * sentiment gauge that historically marks good buying zones when it is deeply fearful.
 * This is a SENTIMENT family, completely different from price mean-reversion or trend.
 * When it buys and sells: Buys BTC only when the Fear & Greed index is EXTREME fear
 * (below 12) while price is above a rising 200-day average, then holds through the
 * recovery until the index turns strongly greedy (above 68) or the trend breaks. A
 * cooldown prevents re-buying immediately after a loss.
 * When it does NOT work: In a sustained bear market the index stays fearful for a long
 * time and each "fear" buy catches a falling knife — the 200-day gate limits but cannot
 * fully prevent this. It also sits in cash during a steady bull grind and lags
 * buy-and-hold.
 */
function onUpdate(ctx) {
  const pos = ctx.position;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const fg = ctx.data('fear_greed');
  const sma200 = ctx.sma(200, 1);
  const sma200prev = ctx.sma(200, 2);
  if (fg == null || sma200 == null || sma200prev == null) return null;

  const uptrend = sma200 > sma200prev;
  // Cooldown: don't re-enter within 20 bars of the last exit to avoid churn.
  const lastExit = ctx.state.lastExit || -1e9;
  const sinceExit = ctx.i - lastExit;

  if (pos > 0) {
    // Take profit once sentiment turns strongly greedy or the trend breaks.
    ctx.watch([
      { side: 'sell', price: sma200, trigger: 'below', note: 'trend break', conds: [
        { label: 'Fear-Greed', now: fg, op: '>', ref: 68, closed: true },
        { label: 'trend up', ok: uptrend }
      ] },
      { side: 'sell', price: 68, trigger: 'above', note: 'greedy exit', conds: [
        { label: 'price vs SMA200', now: price, op: '>=', ref: sma200, closed: true }
      ] }
    ]);
    if (fg > 68 || price < sma200) {
      ctx.state.lastExit = ctx.i;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  // Contrarian entry: only extreme fear, in an uptrend, and after the cooldown.
  if (uptrend && fg < 12 && sinceExit > 20) {
    ctx.watch([]);
    return { side: 'buy', qty: (ctx.cash / price) * 0.95 };
  }
  ctx.watch([
    { side: 'buy', price: 12, trigger: 'below', note: 'fear entry', conds: [
      { label: 'SMA200 rising', ok: uptrend },
      { label: 'cooldown bars', now: sinceExit, op: '>', ref: 20, closed: true }
    ] }
  ]);
  return null;
}
