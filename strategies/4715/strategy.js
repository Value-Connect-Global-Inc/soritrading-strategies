/*
 * @coinsori-strategy v1
 * name: BTC On-Chain Regime 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin's network usage (active addresses) is a fundamental signal that
 * often leads price — when adoption is growing the bull regime is intact, when it shrinks the
 * bull is over. Combining price trend with on-chain growth filters out false breakouts.
 * When it buys and sells: buys when price closes above its 200-day SMA AND the 30-day average
 * active addresses is above its 60-day-ago level (network growing). Sells when price closes
 * below the 200-day SMA or the 30-day average addresses falls below its 120-day-ago level.
 * When it does NOT work: in choppy sideways markets where price oscillates around the 200-day
 * SMA it whipsaws; and when price and on-chain usage decouple (e.g. a pure liquidity rally).
 * Needs the addr dataset connected.
 */
const addrHist = []; // module-level history of 30-day avg active addresses, one per bar

function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const addr = ctx.data('addr_sma30');
  if (addr == null) return null; // on-chain data missing — never treat null as 0
  addrHist.push(addr);
  if (addrHist.length < 130) return null; // need 120-bar history for the on-chain lookback

  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;
  const prevClose = ctx.closes.at(-2);
  const pos = ctx.position;

  // Exit first: trend broken OR on-chain usage collapsing (30d avg below its 120d-ago level)
  if (pos > 0) {
    const addr120 = addrHist[addrHist.length - 121];
    if (prevClose < sma200 || addr < addr120) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: sma200, trigger: 'below', note: 'SMA200 breakdown' },
               { side: 'sell', price: addr120, trigger: 'below', note: 'on-chain usage collapse' }]);
    return null;
  }

  // Entry: price above 200-day SMA AND 30d avg addresses above its 60d-ago level (network growing)
  const addr60 = addrHist[addrHist.length - 61];
  const trendUp = prevClose > sma200;
  const onchainUp = addr > addr60;
  if (!(trendUp && onchainUp)) {
    ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'SMA200 reclaim',
                 conds: [{ label: 'on-chain 30d avg rising', ok: onchainUp, closed: true }] }]);
    return null;
  }

  const qty = (ctx.cash * 0.99) / price;
  if (qty <= 0) return null;
  ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'SMA200 reclaim',
               conds: [{ label: 'on-chain 30d avg rising', ok: onchainUp, closed: true }] }]);
  return { side: 'buy', qty };
}
