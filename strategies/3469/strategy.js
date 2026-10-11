/*
 * @coinsori-strategy v1
 * name: OnChain & Sentiment Momentum BTC 4h
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Combines on-chain network activity growth with market sentiment (Fear & Greed) to capture robust medium-term Bitcoin momentum.
 * When it buys and sells: Buys when active addresses exceed their moving average and Fear & Greed is recovering from low levels; sells on extreme greed or trend breakdown.
 * When it does not work: Suffers in prolonged range-bound markets or sudden macro shocks where on-chain metrics lag price action.
 */

function onUpdate(ctx) {
  const p = ctx.price;
  if (!p) return null;

  // 1) Indicators
  const sma50 = ctx.sma(50, 1);
  const rsi = ctx.rsi(14, 1);
  const fg = ctx.data('fg');
  const addr = ctx.data('addr');
  const addr_sma = ctx.data('addr_sma30');

  if (sma50 == null || rsi == null || fg == null || addr == null || addr_sma == null) {
    return null;
  }

  const pos = ctx.position;

  // Watch display for live card
  ctx.watch([
    { side: 'buy', price: sma50, trigger: 'above', note: 'SMA50 Trend & On-chain', conds: [
      { label: 'RSI(14)', now: rsi, op: '>', ref: 45, closed: true },
      { label: 'FG > 25', now: fg, op: '>', ref: 25, closed: true },
      { label: 'Addr > Sma30', now: addr, op: '>', ref: addr_sma, closed: true }
    ]},
    { side: 'sell', price: p * 0.94, trigger: 'below', note: 'Hard Stop Loss' }
  ]);

  // 2) Entry logic: Buy when price > SMA50, RSI > 45, FG > 25, and on-chain addresses > 30sma
  if (pos === 0) {
    if (p > sma50 && rsi > 45 && fg > 25 && addr > addr_sma) {
      const qty = (ctx.cash / p) * 0.98;
      return { side: 'buy', qty: qty };
    }
  }

  // 3) Exit logic: Sell if RSI > 75 (overbought) or FG > 85 or price drops below SMA50
  if (pos > 0) {
    if (rsi > 75 || fg > 85 || p < sma50 * 0.96) {
      return { side: 'sell', qty: pos };
    }
  }

  return null;
}
