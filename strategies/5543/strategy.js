/*
 * @coinsori-strategy v1
 * name: BTC VIX-Regime-Gated Trend 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: US equity volatility (VIX) is a risk-off gauge that leads crypto. When VIX is calm, risk appetite supports BTC trends; when VIX spikes, crypto tends to sell off. Gating a BTC breakout on a calm VIX regime avoids buying into panic.
 * When it buys and sells: Buy on a 20-day price breakout only while VIX is below 25 (calm regime). Sell when price breaks below the 10-day low or falls 2.5x ATR below entry (hard stop).
 * When it does NOT work: In a crypto-specific bull run during a calm-equity period it works, but in a regime where VIX stays low while crypto crashes on its own (e.g. a crypto-only deleveraging), the gate gives no protection. It also misses breakouts right after VIX falls back below 25.
 */
function onUpdate(ctx) {
  const vix = ctx.data("base_vix");
  if (vix == null) return null;          // no VIX data -> stay out

  const price = ctx.price;
  const pos = ctx.position;
  const entry = ctx.entryPx;
  const atr = ctx.atr(14, 1);
  if (atr == null) return null;

  // --- Hard stop: exit if price falls 2.5x ATR below entry.
  if (pos > 0 && entry != null) {
    const stop = entry - 2.5 * atr;
    ctx.watch([{ side:'sell', price: stop, trigger:'below', note:'hard stop 2.5x ATR' }]);
    if (price <= stop) {
      return { side:'sell', qty: pos, reduceOnly: true };
    }
  }

  // --- Trend exit: break below 10-day low closes the trade.
  const low10 = ctx.low(10, 1);
  if (pos > 0 && low10 != null) {
    ctx.watch([{ side:'sell', price: low10, trigger:'below', note:'10-day low break' }]);
    if (price <= low10) {
      return { side:'sell', qty: pos, reduceOnly: true };
    }
  }

  // --- Entry: 20-day breakout while VIX is calm (below 25 = no panic regime).
  // VIX 25 = roughly the long-term median; above that volatility is elevated and breakouts are risky.
  const hi20 = ctx.high(20, 1);
  if (pos === 0 && hi20 != null && vix < 25 && price > hi20) {
    ctx.watch([{ side:'buy', price: hi20, trigger:'above', note:'20d breakout & VIX<25' }]);
    return { side:'buy', qty: ctx.cash / price * 0.99 };
  }

  ctx.watch([{ side:'buy', note:'waiting 20d breakout & VIX<25' }]);
  return null;
}
