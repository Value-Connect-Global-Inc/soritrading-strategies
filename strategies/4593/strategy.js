/*
 * @coinsori-strategy v1
 * name: OnChain StateProbe (diagnostic)
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Diagnostic only: tests whether ctx.state persists across bars. Buys once
 * the buffer reaches 15 entries; if state does not persist this never trades.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const st = ctx.state || {};
  const buf = st.buf || [];
  buf.push(1);
  if (buf.length > 15) buf.shift();
  st.buf = buf;

  if (ctx.position > 0) return null;
  if (buf.length >= 15 && buf.length === 15) {
    return { side: 'buy', qty: (ctx.cash / price) * 0.95 };
  }
  return null;
}
