/*
 * @coinsori-strategy v1
 * name: PROBE addr growing inverted 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Diagnostic: same growing computation as 5533 but buys when addr30 is BELOW
 * addrLong instead of above. If this trades, the sign was inverted and the
 * data is actually declining (or my assumption about direction was wrong).
 */
function onUpdate(ctx) {
  const LONG = 120;
  const addrRaw = ctx.data('addr');
  if (addrRaw == null) return null;
  const s = ctx.state;
  if (s.lastBar !== ctx.i) {
    if (s.lastAddr != null) {
      s.hist = s.hist || [];
      s.hist.push(s.lastAddr);
      if (s.hist.length > LONG * 2) s.hist.shift();
    }
    s.lastBar = ctx.i;
  }
  s.lastAddr = addrRaw;
  const hist = s.hist || [];
  if (hist.length < LONG + 30) return null;
  let sum30 = 0, sumLong = 0;
  for (let k = 0; k < hist.length; k++) {
    if (k >= hist.length - 30) sum30 += hist[k];
    sumLong += hist[k];
  }
  const declining = (sum30 / 30) < (sumLong / hist.length); // INVERTED
  const pos = ctx.position || 0;
  if (declining) {
    if (pos > 0) return null;
    return { side: 'buy', qty: 0.001 };
  } else {
    if (pos <= 0) return null;
    return { side: 'sell', qty: pos, reduceOnly: true };
  }
}
