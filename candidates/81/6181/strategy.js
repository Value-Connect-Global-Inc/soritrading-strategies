/*
 * @coinsori-strategy v1
 * name: BTC 4H Dual-Channel Trend USDM
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: BTC's biggest moves are long trends in BOTH directions — bull runs
 * and bear crashes. A wide 100-bar channel breakout catches those trends, and because we
 * trade perpetual futures we can SHORT the down-legs instead of sitting out and missing
 * the crash. A 3xATR stop plus volatility-scaled position size keep any single bad trade
 * small, so the account survives whipsaws and black-swan gaps.
 * When it buys and sells: goes long when price closes above the highest high of the last
 * 100 bars while price is above its 200-bar average; goes short when price closes below
 * the lowest low of the last 100 bars while price is below its 200-bar average. A long is
 * closed when price breaks the 20-bar low or hits a 3xATR stop below entry; a short is
 * closed on the 20-bar high or a 3xATR stop above entry.
 * When it does NOT work: a long sideways range with no trend in either direction — the
 * channel gets broken up and down repeatedly, every reversal is a small loss, and fees
 * add up on top. Volatility scaling cuts size during those choppy periods but cannot
 * remove the cost.
 */
function onUpdate(ctx) {
  const pos = ctx.position || 0;
  const st = ctx.state;

  // closed-bar channels and trend line (ago>=1: identical in backtest, paper and live)
  let hh100 = -Infinity, ll100 = Infinity, ll20 = Infinity, hh20 = -Infinity;
  for (let i = 1; i <= 100; i++) {
    const h = ctx.highs.at(-1 - i), l = ctx.lows.at(-1 - i);
    hh100 = Math.max(hh100, h); ll100 = Math.min(ll100, l);
  }
  for (let i = 1; i <= 20; i++) {
    const h = ctx.highs.at(-1 - i), l = ctx.lows.at(-1 - i);
    hh20 = Math.max(hh20, h); ll20 = Math.min(ll20, l);
  }
  const ema200 = ctx.ema(200, 1);
  const atr = ctx.atr(14, 1);
  if (!isFinite(hh100) || !isFinite(ll100) || !isFinite(hh20) || !isFinite(ll20) || ema200 == null || atr == null) return null;
  const price = ctx.price;

  // volatility target: size so that one ATR move is ~2% of the account, capped at 95% of cash
  // (a wild market gets a smaller position — this is what keeps a bad regime from ruining the account)
  const volScale = Math.min(1, (0.02 * price) / Math.max(atr, 1e-9));
  const qty = (ctx.cash / price) * 0.95 * volScale;

  if (pos > 0) {
    if (st.stop == null) st.stop = (ctx.entryPx != null ? ctx.entryPx : price) - 3 * atr;
    ctx.watch([
      { side: 'sell', price: ll20, trigger: 'below', note: '20-bar low long exit' },
      { side: 'sell', price: st.stop, trigger: 'below', note: '3xATR stop' }
    ]);
    if (price < ll20 || price <= st.stop) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }
  if (pos < 0) {
    if (st.stop == null) st.stop = (ctx.entryPx != null ? ctx.entryPx : price) + 3 * atr;
    ctx.watch([
      { side: 'buy', price: hh20, trigger: 'above', note: '20-bar high short exit' },
      { side: 'buy', price: st.stop, trigger: 'above', note: '3xATR stop' }
    ]);
    if (price > hh20 || price >= st.stop) return { side: 'buy', qty: -pos, reduceOnly: true };
    return null;
  }

  st.stop = null;
  ctx.watch([
    { side: 'buy', price: hh100, trigger: 'above', note: '100-bar high long', conds: [{ label: 'above EMA200', ok: price > ema200 }] },
    { side: 'sell', price: ll100, trigger: 'below', note: '100-bar low short', conds: [{ label: 'below EMA200', ok: price < ema200 }] }
  ]);
  if (price > hh100 && price > ema200) return { side: 'buy', qty };
  if (price < ll100 && price < ema200) return { side: 'sell', qty };
  return null;
}
