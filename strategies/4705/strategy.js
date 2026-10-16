/*
 * @coinsori-strategy v1
 * name: BTC MACD Trend 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: MACD crossover is a classic momentum signal. Restricting entries to times when
 * price is above the 200-SMA keeps the strategy on the right side of the long-term trend, avoiding
 * bear-market whipsaws. This is a different mechanism from the price-channel Donchian breakout.
 * When it buys and sells: buys when MACD line crosses above its signal line (both on closed bars)
 * AND price is above the 200-SMA. Sells when MACD crosses below signal, or when a closed bar closes
 * below the 200-SMA.
 * When it does NOT work: in a sideways market MACD crosses back and forth, generating small losing
 * trades. It lags sharp reversals (MACD is slow). It is fully out during bear markets so it never
 * catches the bottom.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const c = ctx.closes;
  if (c.length < 210) return null;

  const m1 = ctx.macd(12, 26, 9, 1); // last closed bar
  const m2 = ctx.macd(12, 26, 9, 2); // bar before that
  if (m1 == null || m2 == null || m1.signal == null || m2.signal == null) return null;

  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;

  const NB = c.length - 2;
  const prevClose = c.at(-2);
  const pos = ctx.position;

  if (pos > 0) {
    if (prevClose < sma200) return { side: 'sell', qty: pos };
    if (m2.macd > m2.signal && m1.macd <= m1.signal) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: sma200, trigger: 'below', note: 'trend break' }]);
    return null;
  }

  const crossUp = m2.macd <= m2.signal && m1.macd > m1.signal; // closed bars only
  const aboveSma = prevClose > sma200;
  if (!(crossUp && aboveSma)) {
    ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'MACD cross in uptrend',
                 conds: [{ label: 'MACD>signal', ok: m1.macd > m1.signal, closed: true }] }]);
    return null;
  }

  const qty = (ctx.cash * 0.99) / price;
  if (qty <= 0) return null;

  ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'MACD cross up' }]);
  return { side: 'buy', qty };
}
