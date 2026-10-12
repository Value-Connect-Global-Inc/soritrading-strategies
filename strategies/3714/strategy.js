/*
 * @coinsori-strategy v1
 * name: AddrAdoptionTrendBTC
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin's active-address count (addr) is a network-usage signal — when real network
 * usage is growing (addr above its 30-day average) while price is in a long-term uptrend, the rally
 * is healthier and more likely to continue. We ride BTC only when both price and network adoption
 * are rising.
 * When it buys and sells: buys when a close is above the 200-day average AND addr is above its
 * 30-day average. Sells when the close drops below the 50-day average or a 2x ATR stop is hit.
 * When it does NOT work: in a price rally driven by speculation rather than usage (meme-driven,
 * ETF-driven runs), addr stays flat and the strategy misses the move. In a bear, price breaks the
 * 50-day average and it exits late-ish but the hard stop caps the loss.
 */
function onUpdate(ctx) {
  const px = ctx.price;
  if (!Number.isFinite(px) || px <= 0) return null;

  // On-chain data may arrive as strings — coerce to numbers, guard non-finite.
  const rawAddr = ctx.data('addr');
  const rawAddrSma = ctx.data('addr_sma30');
  if (rawAddr == null || rawAddrSma == null) return null;
  const addr = Number(rawAddr);
  const addrSma = Number(rawAddrSma);
  if (!Number.isFinite(addr) || !Number.isFinite(addrSma) || addr <= 0) return null;

  const sma200 = ctx.sma(200, 1);
  const sma50 = ctx.sma(50, 1);
  const atr = ctx.atr(14, 1);
  if (sma200 == null || sma50 == null || atr == null || atr <= 0) return null;

  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const adoptionUp = addr > addrSma; // network usage growing vs its 30-day average
  const pos = ctx.position || 0;

  if (pos > 0) {
    const hardStop = ctx.entryPx - 2 * atr;
    if (px <= hardStop || prevClose < sma50) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2x ATR stop' },
               { side: 'sell', price: sma50, trigger: 'below', note: 'trend exit' }]);
    return null;
  }

  // Vol-targeted size: risk 1% of equity via 2x ATR stop, capped at 40% of equity.
  const riskPerTrade = 0.01 * ctx.cash;
  let qty = riskPerTrade / (2 * atr);
  const maxQty = (ctx.cash / px) * 0.40;
  qty = Math.min(qty, maxQty);

  // Entry: long-term uptrend AND network adoption growing.
  if (prevClose > sma200 && adoptionUp) return { side: 'buy', qty };
  ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'SMA200 reclaim',
               conds: [{ label: 'addr > 30d avg', ok: adoptionUp }] }]);
  return null;
}
