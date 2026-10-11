/*
 * @coinsori-strategy v1
 * name: Active Addresses Trend Filter Strategy
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: On-chain network growth reflects fundamental adoption which drives price trends.
 * When it buys and sells: Buys when active addresses are growing (above their 30-day MA) and price is above EMA50; sells when active address momentum reverses or price drops below EMA50.
 * When it does NOT work: Bear markets where active address metrics lag or give false breakouts during network noise.
 */

function onUpdate(ctx) {
  const price = ctx.price;
  if (!price) return null;

  const ema50 = ctx.ema(50);
  const addrVal = ctx.data('addr');
  const addrSma = ctx.data('addr_sma30');

  if (ema50 == null || addrVal == null || addrSma == null) return null;

  const pos = ctx.position;
  const isLong = pos > 0;

  // Watch conditions for UI
  ctx.watch([
    { side: 'buy', price: ema50, trigger: 'above', note: 'Active Addresses > SMA30 & Price > EMA50', conds: [
      { label: 'Addr > SMA30', ok: addrVal > addrSma },
      { label: 'Price > EMA50', ok: price > ema50 }
    ]},
    { side: 'sell', price: price * 0.95, trigger: 'below', note: 'Stop-loss or Trend Exit', conds: [
      { label: 'Addr < SMA30', ok: addrVal < addrSma }
    ]}
  ]);

  // Entry: Buy when active addresses exceed their 30-period SMA and price is above EMA50
  if (!isLong && addrVal > addrSma && price > ema50) {
    const qty = (ctx.cash / price) * 0.99;
    if (qty > 0) return { side: 'buy', qty };
  }

  // Exit: Sell when active addresses drop below SMA or price falls below EMA50
  if (isLong && (addrVal < addrSma || price < ema50)) {
    return { side: 'sell', qty: pos };
  }

  return null;
}
