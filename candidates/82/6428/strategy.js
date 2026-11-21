/*
 * @coinsori-strategy v1
 * name: Trend-Follow Basket 5-Asset 4H
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT, XRP/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: crypto coins trend for weeks on the 4h chart but each coin
 * has its own trend timing — BTC and the alts do not always move together. Running
 * the same simple trend rule on five coins rides each coin's own uptrend and sits
 * out its own downtrend, spreading the bets across coins.
 * When it buys and sells: on each coin, buys when the price is above a RISING
 * 200-bar average; sells when price is below a FALLING 200-bar average, or on a
 * 30% hard stop. Alts (ETH/SOL/BNB/XRP) only buy while BTC's own trend is up,
 * because alts move with BTC and crash harder when BTC turns down. Position size
 * scales down in high volatility.
 * When it does NOT work: in a long choppy range with a flat 200-bar line it stays
 * mostly flat and misses the small bounces; in a coordinated crash all coins fall
 * together and the hard stop is the only protection; the BTC gate can keep alts
 * out during an alt-only rally while BTC is still basing.
 */
function onUpdate(ctx) {
  const sym = ctx.sym;              // base symbol, e.g. 'BTC'
  const sma = ctx.sma(200, 1);      // trend line, closed bar
  const smaOld = ctx.sma(200, 30);  // trend line 30 bars ago, for slope
  const atr = ctx.atr(14, 1);       // 4h volatility, closed bar
  if (sma == null || smaOld == null || atr == null) return null;

  const pos = ctx.position || 0;
  const price = ctx.price;
  const STOP_PCT = 0.70;            // hard stop: sell if price falls 30% below entry
  const TARGET_ATR = 0.030;         // vol target: aim ~3% move per bar, scale down above it
  const MAX_QTY_FRAC = 0.98;        // never use more than 98% of cash
  const MIN_QTY_FRAC = 0.10;        // never go below 10% even in extreme vol

  // Vol-target sizing: full size in normal conditions, smaller in high volatility
  const atrPct = atr / price;
  let frac = atrPct > 0 ? TARGET_ATR / atrPct : MAX_QTY_FRAC;
  if (frac > MAX_QTY_FRAC) frac = MAX_QTY_FRAC;
  if (frac < MIN_QTY_FRAC) frac = MIN_QTY_FRAC;

  // Remember BTC's own trend for the alt gate (processed on BTC's own symbol)
  if (sym === 'BTC') {
    ctx.state.btcUp = price > sma && sma > smaOld;
  }
  const btcUp = sym === 'BTC' ? (price > sma && sma > smaOld) : !!ctx.state.btcUp;

  // ---- while holding: exits ----
  if (pos > 0) {
    const entry = ctx.entryPx != null ? ctx.entryPx : price;
    ctx.watch([
      { side: 'sell', price: sma, trigger: 'below', note: 'Trend rollover exit', conds: [{ label: 'SMA200 falling', ok: sma < smaOld }] },
      { side: 'sell', price: entry * STOP_PCT, trigger: 'below', note: 'Hard stop -30%' },
    ]);
    // exit only when the trend has rolled over: price below a FALLING SMA200
    if (price < sma && sma < smaOld) return { side: 'sell', qty: pos, reduceOnly: true };
    if (price <= entry * STOP_PCT) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }

  // ---- flat: enter in a confirmed uptrend; alts also need BTC's trend up ----
  ctx.watch([{ side: 'buy', price: sma, trigger: 'above', note: 'Uptrend (SMA200 rising)', conds: [{ label: 'SMA200 rising', ok: sma > smaOld }] }]);
  const ownUp = price > sma && sma > smaOld;
  const gateOk = sym === 'BTC' ? true : btcUp;
  if (ownUp && gateOk) {
    return { side: 'buy', qty: (ctx.cash / price) * frac };
  }
  return null;
}
