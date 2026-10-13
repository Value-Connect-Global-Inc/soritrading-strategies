function onUpdate(ctx) {
  const hr = ctx.data('hashrate');
  if (hr == null) return null;
  const pos = ctx.position;
  if (pos > 0) return { side: 'sell', qty: pos };
  return { side: 'buy', qty: 0.001 };
}
