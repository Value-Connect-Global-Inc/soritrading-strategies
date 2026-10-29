/*
 * @coinsori-strategy v1
 * name: Multi-Asset SMA200 Trend Basket 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The single-asset SMA200 trend (champion) is robust, but it is all-in on one coin. Running the same proven 200-day trend rule on four major coins independently diversifies the risk: when only one coin is in a bull trend, only that one is held, and a crash in one coin does not drag the whole account down.
 * When it buys and sells: On each coin, buy when its close is above its own 200-day average; sell when it falls below. Each coin is sized to its own share of cash, so a coin in a downtrend simply sits in cash while the others keep working.
 * When it does NOT work: In a broad coordinated crypto bear (all four below their 200-day averages) it holds only cash — safe but flat. It lags sharp V-shaped recoveries and can whipsaw in long sideways ranges, same weakness as any trend follower.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const pos = ctx.position;

  ctx.watch([
    { side: 'buy', price: sma200, trigger: 'above', note: 'close above SMA200' },
    { side: 'sell', price: sma200, trigger: 'below', note: 'close below SMA200' }
  ]);

  if (pos > 0) {
    if (prevClose < sma200) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  // allocation engine must be healthy before opening new positions
  if (ctx.alloc && ctx.alloc.status !== 'ok') return null;

  if (prevClose > sma200 && ctx.cash > 0) {
    // buy with this symbol's cash share (engine splits starting cash across the 4 symbols)
    const qty = (0.99 * ctx.cash) / price * 0.99;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
