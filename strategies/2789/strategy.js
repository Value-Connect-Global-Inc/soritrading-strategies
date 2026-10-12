/*
 * @coinsori-strategy v1
 * name: Regime-Switch Hybrid SOL 4H (rising-EMA fix)
 * ex: binance
 * syms: SOLUSDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Crypto alternates between panic crashes (where buying
 * fear pays) and steady uptrends (where riding the trend pays). A single rule
 * can't do both, so this switches between two validated modes.
 * When it buys and sells: in the BEAR leg it buys only at deep fear and exits
 * on a quick recovery or a 4x ATR stop. In the BULL leg it buys a pullback to
 * the 20-EMA only when the 20-EMA is above the 50-EMA AND rising (confirmed,
 * strengthening uptrend) and exits on a 50-EMA break or a 3x ATR stop.
 * When it does NOT work: in a calm grind-down the fear leg never triggers and
 * we sit in cash; and in a sharp V-crash even the wide stop takes a hit.
 *
 * 2024-01-15: display only change — added ctx.watch declarations, no trade logic changed.
 */
function onUpdate(ctx) {
  const pos = ctx.position;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const fg = ctx.data('fear_greed');
  const ema20 = ctx.ema(20, 1), ema50 = ctx.ema(50, 1);
  const ema20prev = ctx.ema(20, 2);
  const atr = ctx.atr(14, 1);
  if (ema20 == null || ema50 == null || ema20prev == null || atr == null) return null;

  const st = ctx.state;

  if (pos > 0) {
    const hi = Math.max(st.peak || ctx.entryPx, price);
    st.peak = hi;
    if (st.leg === 'bear') {
      if ((fg != null && fg > 40) || price <= hi - 4 * atr) {
        ctx.watch([
          { side: 'sell', price: hi - 4 * atr, trigger: 'below', note: '4x ATR stop', conds: [
            { label: 'Fear & Greed', now: fg, op: '>', ref: 40, closed: true }
          ]}
        ]);
        st.peak = null; st.leg = null;
        return { side: 'sell', qty: pos };
      }
      ctx.watch([
        { side: 'sell', price: hi - 4 * atr, trigger: 'below', note: '4x ATR stop', conds: [
          { label: 'Fear & Greed', now: fg, op: '>', ref: 40, closed: true }
        ]}
      ]);
      return null;
    }
    if (ema20 < ema50 || price <= hi - 3 * atr) {
      ctx.watch([
        { side: 'sell', price: hi - 3 * atr, trigger: 'below', note: '3x ATR stop' },
        { side: 'sell', price: ema50, trigger: 'below', note: '50-EMA break', conds: [
          { label: '20-EMA < 50-EMA', ok: ema20 < ema50, closed: true }
        ]}
      ]);
      st.peak = null; st.leg = null;
      return { side: 'sell', qty: pos };
    }
    ctx.watch([
      { side: 'sell', price: hi - 3 * atr, trigger: 'below', note: '3x ATR stop' },
      { side: 'sell', price: ema50, trigger: 'below', note: '50-EMA break', conds: [
        { label: '20-EMA < 50-EMA', ok: ema20 < ema50, closed: true }
      ]}
    ]);
    return null;
  }

  if (fg != null && fg < 20 && ema20 < ema50) {
    ctx.watch([]);
    st.peak = price; st.leg = 'bear';
    return { side: 'buy', qty: ctx.cash / price * 0.5 };
  }

  // Bull entry: confirmed uptrend (20>50), 20-EMA RISING (selectivity fix), pullback to it.
  if (ema20 > ema50 && ema20 > ema20prev && price <= ema20 + 0.5 * atr) {
    ctx.watch([]);
    st.peak = price; st.leg = 'bull';
    return { side: 'buy', qty: ctx.cash / price * 0.5 };
  }

  // Waiting for entries
  const bearEntry = { side: 'buy', price: ema20 + 0.5 * atr, trigger: 'below', note: 'Bull pullback', conds: [
    { label: '20-EMA > 50-EMA', ok: ema20 > ema50, closed: true },
    { label: '20-EMA rising', ok: ema20 > ema20prev, closed: true }
  ]};
  const bullEntry = { side: 'buy', price: ema20 + 0.5 * atr, trigger: 'below', note: 'Bull pullback', conds: [
    { label: '20-EMA > 50-EMA', ok: ema20 > ema50, closed: true },
    { label: '20-EMA rising', ok: ema20 > ema20prev, closed: true }
  ]};
  if (fg != null && fg < 20 && ema20 < ema50) {
    ctx.watch([{ side: 'buy', price: ema20 + 0.5 * atr, trigger: 'below', note: 'Bear fear entry', conds: [
      { label: 'Fear & Greed', now: fg, op: '<', ref: 20, closed: true },
      { label: '20-EMA < 50-EMA', ok: ema20 < ema50, closed: true }
    ]}]);
  } else if (ema20 > ema50 && ema20 > ema20prev) {
    ctx.watch([bullEntry]);
  } else {
    ctx.watch([]);
  }
  return null;
}
