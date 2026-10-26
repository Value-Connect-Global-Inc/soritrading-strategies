/*
 * @coinsori-strategy v1
 * name: BTC NDX-Regime-Gated Trend 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: BTC trades as a risk asset that correlates with tech equities (NASDAQ-100). When NDX is in an uptrend (above its 200-day average), crypto breakouts tend to follow through; when NDX is weak, BTC breakouts fail. Gating a BTC breakout on equity risk appetite is a cross-asset regime filter.
 * When it buys and sells: Buy on a 20-day price breakout ONLY while NDX is above its own 200-day average. Sell when price breaks below the 10-day low or falls 2.5x ATR below entry (hard stop).
 * When it does NOT work: In a crypto-specific bull run during an equity downturn (BTC decoupling), the gate wrongly keeps you out. In a crypto-only deleveraging while equities are fine, the gate gives no protection.
 */
function onUpdate(ctx) {
  const ndx = ctx.data("base_ndx");
  if (ndx == null) return null;          // no NDX data -> stay out

  // Track NDX history ourselves (ctx.data gives the current value only; ctx.sma is for the traded asset).
  if (ctx.state.ndxHist == null) ctx.state.ndxHist = [];
  const hist = ctx.state.ndxHist;
  hist.push(ndx);
  if (hist.length > 210) hist.shift();
  if (hist.length < 200) return null;    // need 200 days of NDX to judge its regime

  // NDX 200-day average from OUR stored history (all closed values by construction).
  let sum = 0;
  for (let i = 0; i < 200; i++) sum += hist[hist.length - 1 - i];
  const ndxAvg200 = sum / 200;
  const ndxRiskOn = ndx > ndxAvg200;

  const price = ctx.price;
  const pos = ctx.position;
  const entry = ctx.entryPx;
  const atr = ctx.atr(14, 1);
  if (atr == null) return null;

  if (pos > 0 && entry != null) {
    const stop = entry - 2.5 * atr;
    ctx.watch([{ side:'sell', price: stop, trigger:'below', note:'hard stop 2.5x ATR' }]);
    if (price <= stop) {
      return { side:'sell', qty: pos, reduceOnly: true };
    }
  }

  const low10 = ctx.low(10, 1);
  if (pos > 0 && low10 != null) {
    ctx.watch([{ side:'sell', price: low10, trigger:'below', note:'10-day low break' }]);
    if (price <= low10) {
      return { side:'sell', qty: pos, reduceOnly: true };
    }
  }

  // Entry: 20-day breakout while NDX is above its 200-day average (equity risk-on).
  const hi20 = ctx.high(20, 1);
  if (pos === 0 && hi20 != null && ndxRiskOn && price > hi20) {
    ctx.watch([{ side:'buy', price: hi20, trigger:'above', note:'20d breakout & NDX risk-on' }]);
    return { side:'buy', qty: ctx.cash / price * 0.99 };
  }

  ctx.watch([{ side:'buy', note:'waiting 20d breakout & NDX risk-on' }]);
  return null;
}
