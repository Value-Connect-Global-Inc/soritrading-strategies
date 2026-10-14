/*
 * @coinsori-strategy v1
 * name: Multi-Asset Trend Basket 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, XRP/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Crypto assets move together but not in lockstep. Instead of
 *   betting everything on one coin, this basket runs the same simple rule on five
 *   majors (20% of cash each): be long only while that coin trades above its
 *   200-day average. Diversification smooths the ride — the winners carry the
 *   winners, and each coin's own trend filter keeps it out of its bear markets.
 * When it buys and sells: for each coin, buy when its daily close is above its
 *   200-day average, sized to ~20% of cash. Sell that coin when its close falls
 *   back below the 200-day average.
 * When it does NOT work: in a broad coordinated crypto bear all five trend gates
 *   go flat together (capital safe, but no upside); in a single-coin melt-up it
 *   lags buy-and-hold of that coin; the 200-day filter buys late into rallies and
 *   sells late into dips, so it underperforms in parabolic moves.
 */
function onUpdate(ctx) {
  const sym = ctx.sym;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const sma200 = ctx.sma(200, 1);
  const prevClose = ctx.closes.at(-2);
  if (sma200 == null || prevClose == null) return null;

  const pos = ctx.pos(sym);
  const legShare = 0.20; // 5 legs x 20% = full cash if all five are in uptrends

  if (pos > 0) {
    if (prevClose < sma200) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: sma200, trigger: 'below', note: 'close below 200d' }]);
    return null;
  }

  if (prevClose > sma200) {
    ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'close above 200d' }]);
    const qty = (ctx.cash / price) * legShare;
    if (qty <= 0) return null;
    return { side: 'buy', qty };
  }
  return null;
}
