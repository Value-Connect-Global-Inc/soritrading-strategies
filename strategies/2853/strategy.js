/*
 * @coinsori-strategy v1
 * name: OBV Champion + Dual On-Chain Gate BTC 1D
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The OBV volume-flow trend captures bull momentum but
 * carries high drawdown by staying long through bear/flat regimes. The dual
 * on-chain regime (active addresses AND hashrate BOTH rising) is the one
 * defensive signal that stayed positive on every fresh window with far lower
 * drawdown. This combines them: OBV trend for the bull capture, the on-chain
 * gate to sit out regimes where network demand is falling.
 * When it buys and sells: buys when 30-day OBV is rising AND price is above
 * the 100-day average AND volume confirms AND both active addresses and
 * hashrate are above their 30-day averages. Exits fully when OBV turns down
 * OR either on-chain signal falls below its 30-day average.
 * When it does NOT work: on-chain data lags price, so in sharp V-shaped
 * liquidity rallies the gate may keep the strategy in cash while price melts
 * up (it can underperform pure buy-and-hold in strong bulls). The dual gate
 * is strict, so entries are rarer.
 */
function onUpdate(ctx) {
  const pos = ctx.position;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const sma100 = ctx.sma(100, 1);
  const atr = ctx.atr(14, 1);
  if (sma100 == null || atr == null) return null;

  // dual on-chain gate: both active addresses AND hashrate above 30-day avg
  const addr = Number(ctx.data('addr'));
  const addrSm = Number(ctx.data('addr_sma30'));
  const hr = Number(ctx.data('hashrate'));
  const hrSm = Number(ctx.data('hashrate_sma30'));
  if (!Number.isFinite(addr) || addr <= 0) return null;
  if (!Number.isFinite(addrSm) || addrSm <= 0) return null;
  if (!Number.isFinite(hr) || hr <= 0) return null;
  if (!Number.isFinite(hrSm) || hrSm <= 0) return null;
  const addrOk = addr > addrSm * 1.01;
  const hrOk = hr > hrSm * 1.01;
  const gateOk = addrOk && hrOk;
  const gateOff = addr < addrSm * 0.99 || hr < hrSm * 0.99;

  const closes = ctx.closes;
  const vols = ctx.volumes;
  if (!closes || !vols || closes.length < 32) return null;

  let obv = 0;
  const obvSeries = [];
  for (let k = 1; k < closes.length; k++) {
    const c = closes[k], p = closes[k - 1], v = vols[k];
    if (!Number.isFinite(c) || !Number.isFinite(p) || !Number.isFinite(v)) continue;
    if (c > p) obv += v;
    else if (c < p) obv -= v;
    obvSeries.push(obv);
  }
  if (obvSeries.length < 32) return null;
  const obvNow = obvSeries[obvSeries.length - 1];
  const obvPast = obvSeries[obvSeries.length - 31];
  const rising = obvNow > obvPast * 1.01;
  const falling = obvNow < obvPast * 0.99;

  const avgV = ctx.avgVol(30);
  const volOk = avgV != null && Number.isFinite(avgV) && avgV > 0 && ctx.vol > avgV;

  const st = ctx.state;
  let cd = st.cd || 0;
  if (cd > 0) cd--;
  ctx.state.cd = cd;

  const atrPct = atr / price;
  let sizeFrac = 1.0;
  if (atrPct > 0.06) {
    sizeFrac = Math.max(0.5, 1.0 - (atrPct - 0.06) / 0.06);
  }

  // 2024-12-08: display-only watch declaration, trading logic unchanged
  if (pos > 0) {
    // In position — show exit levels (OBV downtrend or on-chain gate off)
    const exitConds = [];
    if (!falling && !gateOff) {
      if (!falling) {
        exitConds.push({ label: 'OBV 30d rising', ok: rising });
      }
      if (!gateOff) {
        exitConds.push({ label: 'On-chain gate on', ok: gateOk });
      }
    }
    ctx.watch([
      { side: 'sell', price: sma100, trigger: 'below', note: 'SMA100 support', conds: [{ label: 'OBV falling', ok: falling }, { label: 'Gate off', ok: gateOff }] }
    ]);
    if ((falling || gateOff) && cd === 0) {
      ctx.state.cd = 5;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  // Not in position — show entry levels (OBV rising + price above SMA100 + volume + gate)
  const entryConds = [
    { label: 'OBV 30d rising', ok: rising },
    { label: 'Price > SMA100', now: price, op: '>', ref: sma100, closed: true },
    { label: 'Volume > avg30', ok: volOk },
    { label: 'On-chain gate on', ok: gateOk }
  ];
  ctx.watch([
    { side: 'buy', price: sma100, trigger: 'above', note: 'SMA100 breakout', conds: entryConds }
  ]);

  if (rising && price > sma100 && volOk && gateOk && cd === 0) {
    ctx.state.cd = 5;
    const qty = ctx.cash / price * 0.95 * sizeFrac;
    return { side: 'buy', qty: qty };
  }
  return null;
}
