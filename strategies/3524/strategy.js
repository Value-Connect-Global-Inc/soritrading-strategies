/*
 * @coinsori-strategy v1
 * name: Fear & Greed Trend Contrarian Strategy
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Exploits extreme market sentiment combined with a medium-term trend filter.
 * When it buys and sells: Buys when Fear & Greed is extremely low (fear) in an upward EMA trend; sells when sentiment turns greedy or trend reverses.
 * When it does NOT work: Extended sideways chop markets with fluctuating sentiment or sudden black swan crashes.
 */

function onUpdate(ctx) {
  const price = ctx.price;
  if (!price) return null;

  const ema50 = ctx.ema(50);
  const fgVal = ctx.data('fg');

  if (ema50 == null || fgVal == null) return null;

  const pos = ctx.position;
  const isLong = pos > 0;

  // Watch conditions for UI
  ctx.watch([
    { side: 'buy', price: ema50, trigger: 'above', note: 'EMA50 Trend & F&G < 30', conds: [
      { label: 'F&G Index', now: fgVal, op: '<', ref: 30, closed: true },
      { label: 'Price > EMA50', ok: price > ema50 }
    ]},
    { side: 'sell', price: price * 1.05, trigger: 'above', note: 'Profit Take / Greed > 75', conds: [
      { label: 'F&G Index', now: fgVal, op: '>', ref: 75, closed: true }
    ]}
  ]);

  // Entry: Buy when Fear & Greed is in extreme fear (< 30) and price is above EMA50 (uptrend dip)
  if (!isLong && fgVal < 30 && price > ema50) {
    const qty = (ctx.cash / price) * 0.99;
    if (qty > 0) return { side: 'buy', qty };
  }

  // Exit: Sell when Fear & Greed reaches extreme greed (> 75) or price falls below EMA50
  if (isLong && (fgVal > 75 || price < ema50)) {
    return { side: 'sell', qty: pos };
  }

  return null;
}
