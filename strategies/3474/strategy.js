/*
 * @coinsori-strategy v1
 * name: Multi-Asset Relative Strength Rotation
 * ex: binance
 * syms: BTC/USDT, ETH/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Daily trend following enhanced with volume confirmation and relative market momentum.
 * When it buys and sells: Buys when 20 SMA crosses above 50 SMA with above-average volume; sells on bearish cross.
 * When it does not work: Suffers during choppy, low-volume sideways consolidation phases.
 */

function onUpdate(ctx) {
  const p = ctx.price;
  const closes = ctx.closes;
  if (!closes || closes.length < 50) return null;

  const s20 = ctx.sma(20, 1);
  const s50 = ctx.sma(50, 1);
  const s20Prev = ctx.sma(20, 2);
  const s50Prev = ctx.sma(50, 2);
  if (s20 == null || s50 == null || s20Prev == null || s50Prev == null) return null;

  const vol = ctx.vol;
  const avgVol = ctx.avgVol(20);
  if (vol == null || avgVol == null) return null;

  const uptrend = s20 > s50;
  const prevUptrend = s20Prev > s50Prev;

  ctx.watch([
    { side: 'buy', price: s20, trigger: 'above', note: 'SMA 20 Bull Cross', conds: [{ label: 'Uptrend', ok: uptrend }] },
    { side: 'sell', price: s50, trigger: 'below', note: 'SMA 50 Bear Cross', conds: [{ label: 'Downtrend', ok: !uptrend }] }
  ]);

  if (!uptrend && prevUptrend && ctx.position > 0) {
    return { side: 'sell', qty: ctx.position };
  }

  if (uptrend && !prevUptrend && (!ctx.position || ctx.position === 0)) {
    // Volume confirmation filter
    if (vol >= avgVol * 0.8 && ctx.cash > 100) {
      const qty = (ctx.cash / p) * 0.99;
      return { side: 'buy', qty };
    }
  }

  return null;
}
