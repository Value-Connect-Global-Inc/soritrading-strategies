/*
 * @coinsori-strategy v1
 * name: BtcPureTrendControl
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * CONTROL for BtcHashrateTrend: same rule but WITHOUT the on-chain hash rate filter.
 * Isolates whether the network-health condition adds value or just delays entries.
 * When it buys and sells: Buys when price is 3% above a rising 200-day average,
 * sized so a 3x ATR stop risks 2% of the account. Sells when price breaks back below
 * the 200-day average, or falls 3x ATR below the entry (hard stop).
 * When it does NOT work: in choppy sideways markets the 200-day average is flat and
 * entries flicker (buy late, sell late). Long only, so it earns nothing in a bear market.
 */

function onUpdate(ctx) {
  const sma200 = ctx.sma(200, 1);
  const sma200b = ctx.sma(200, 51);
  if (sma200 == null || sma200b == null) return null;

  const price = ctx.price;
  const pos = ctx.position || 0;
  const st = ctx.state;

  const atr = ctx.atr(14, 1);
  if (atr == null) return null;

  if (pos === 0) {
    const uptrend = price > sma200 * 1.03 && sma200 > sma200b;
    if (uptrend) {
      const qty = (ctx.cash * 0.02) / (3 * atr);
      st.entryPx = price;
      return { side: 'buy', qty: qty };
    }
    return null;
  }

  const stopPx = st.entryPx != null ? st.entryPx - 3 * atr : price - 3 * atr;
  ctx.watch([
    { side: 'sell', price: stopPx, trigger: 'below', note: '3xATR hard stop' },
    { side: 'sell', price: sma200, trigger: 'below', note: 'SMA200 break' }
  ]);

  if (price < sma200 || price <= stopPx) return { side: 'sell', qty: pos };
  return null;
}
