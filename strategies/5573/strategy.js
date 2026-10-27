/*
 * @coinsori-strategy v1
 * name: BTC On-Chain Capitulation Contrarian 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin's on-chain usage (daily unique active addresses) is a
 * fundamental measure of real demand. When active addresses collapse well below their
 * 30-day average at the same time that price is oversold and below its long-term
 * trend, it marks a genuine capitulation — the weakest hands have left and the panic
 * is usually close to over. Buying these extremes is a contrarian bet on a rebound.
 * When it buys and sells: It buys BTC only when ALL three hold on closed bars: active
 * addresses are below 0.85x their 30-day average, RSI(14) is below 35 (oversold), and
 * price is below its 200-day average (already fallen). It sells when price recovers
 * back above the 200-day average, or immediately if price falls 20% below the entry
 * (hard stop — capitulation can go lower before it bottoms).
 * When it does NOT work: The conditions are rare, so the strategy sits in cash most of
 * the time and can miss long bull runs entirely. A capitulation can also keep falling
 * for weeks (the 20% stop limits this). And if usage keeps declining while price
 * recovers (a "zombie" recovery), the exit is delayed by relying on price only.
 */
function onUpdate(ctx) {
  const closes = ctx.closes;
  if (closes == null || closes.length < 210) return null;

  // On-chain usage from the connected dataset (values appear with the dataset's lag,
  // so no look-ahead): active addresses and their provided 30-day average.
  const addr = ctx.data("addr");
  const addrSma = ctx.data("addr_sma30");
  if (addr == null || addrSma == null || addrSma <= 0) return null;

  const pos = ctx.pos(ctx.sym);
  const price = ctx.price;
  if (price == null || price <= 0) return null;

  const prevClose = closes.at(-2);
  const sma200 = ctx.sma(200, 1);

  if (pos != null && pos > 0) {
    // Hard stop: exit if price falls 20% below entry — capitulation can go lower.
    const entry = ctx.entryPx;
    const stopPx = (entry != null && entry > 0) ? entry * 0.80 : null;
    if (stopPx != null && price <= stopPx) {
      ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: 'hard stop 20%' }]);
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    // Recovery exit: price back above the 200-day average.
    if (sma200 != null && prevClose > sma200) {
      ctx.watch([{ side: 'sell', note: 'recovered above 200d' }]);
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    if (stopPx != null) {
      ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: 'hard stop 20%' },
                 { side: 'sell', trigger: 'above', note: 'recovery above 200d' }]);
    }
    return null;
  }

  // Entry: capitulation = usage collapse + oversold + price below long-term trend.
  const rsi = ctx.rsi(14, 1);
  if (rsi == null || sma200 == null) return null;

  if (addr < 0.85 * addrSma && rsi < 35 && prevClose < sma200) {
    const qty = (ctx.cash / price) * 0.99;
    if (qty <= 0) return null;
    ctx.watch([{ side: 'buy', note: 'capitulation - usage collapse + oversold' }]);
    return { side: 'buy', qty: qty };
  }
  return null;
}
