function onUpdate(ctx) {
  try {
    const m = ctx.market('ETH/USDT');
    if (m != null) {
      for (const k of Object.keys(m)) {
        const v = m[k];
        if (Array.isArray(v) && v.length > 30) return { side: 'buy', qty: 0.0001 };
      }
    }
  } catch (e) {}
  return null;
}
