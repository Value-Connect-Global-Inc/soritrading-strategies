/*
 * @coinsori-strategy v1
 * name: ETH Funding-Squeeze Dip 4H
 * ex: binanceusdm
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Funding is the fee perpetual traders pay each other every 8h. When funding is deeply
 * negative, shorts are crowded and PAYING longs — that is both a contrarian bullish signal (a squeeze is
 * likely) and a small income while holding. When funding turns positive again, the panic is over.
 * When it buys and sells: Buy ETH when the last closed 4h funding is below -0.01% (crowded shorts) AND
 * price is above a rising 200-bar SMA (buying the dip inside an uptrend, not catching a falling knife).
 * Sell everything when funding turns clearly positive (+0.005%), when the close falls below the SMA200,
 * or on a 4x ATR hard stop.
 * When it does NOT work: Funding can stay negative for weeks while price keeps falling in a real bear
 * market — the SMA200 filter limits this but does not eliminate it. In a grind-down with no panic spike
 * the strategy sits out. It also exits early in melt-ups (funding goes very positive fast), so it trails
 * buy-and-hold in parabolic rallies.
 */
function onUpdate(ctx) {
  const funding = ctx.funding; // funding rate per 8h interval, fraction (0.0001 = 0.01%)
  const sma = ctx.sma(200, 1);
  if (sma == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const pos = ctx.position || 0;
  const atr = ctx.atr(14, 1);

  if (pos > 0) {
    const stopPx = (ctx.entryPx != null && atr != null) ? ctx.entryPx - 4 * atr : null;
    const panicOver = funding != null && funding > 0.00005; // longs paying again = panic done
    const trendBreak = prevClose < sma;
    ctx.watch([
      { side: 'sell', price: stopPx, trigger: 'below', note: 'ATR hard stop' },
      { side: 'sell', price: sma, trigger: 'below', note: 'SMA200 trend break' },
      { side: 'sell', price: prevClose, trigger: 'below', note: 'funding positive exit', conds: [{ label: 'funding > +0.005%', ok: panicOver }] }
    ]);
    if (panicOver || trendBreak || (stopPx != null && prevClose < stopPx)) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  const smaPrev = ctx.sma(200, 5);
  if (smaPrev == null) return null;
  const rising = sma > smaPrev;
  const crowdedShorts = funding != null && funding < -0.0001; // shorts paying >0.01% per 8h
  ctx.watch([{ side: 'buy', price: sma, trigger: 'above', note: 'buy panic in uptrend', conds: [{ label: 'funding < -0.01%', ok: crowdedShorts }, { label: 'SMA200 rising', ok: rising }] }]);
  if (crowdedShorts && rising && prevClose > sma) {
    return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.99 };
  }
  return null;
}
