/*
 * @coinsori-strategy v1
 * name: Usage-Exit Confirmed Momentum (BTC 1D)
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin's network usage (daily unique active addresses) grows
 * during real rallies and stalls before they fade. The champion uses usage as an
 * entry gate; this variant ALSO exits when usage starts declining while holding,
 * betting that fading adoption leads price down — cutting drawdowns early.
 * When it buys and sells: buys when 30d return > 0, close > 200d EMA, and usage >=
 * its 30d average. Sells on 200d EMA break, 30d return < 0, 15% hard stop, or when
 * usage falls below its 30d average (new exit).
 * When it does NOT work: in choppy markets where usage oscillates around its average
 * without a real trend, the new exit can trigger whipsaw sells that the champion
 * avoids. If usage is noisy, this variant will trade more often than the champion.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const ema200 = ctx.ema(200, 1);
  if (ema200 == null) return null;

  const c = ctx.closes;
  if (c.length < 32) return null;
  const prevClose = c.at(-2);
  const mom30 = prevClose / c.at(-32) - 1;

  const atr = ctx.atr(14, 1);
  let volScale = 1;
  if (atr != null && atr > 0 && prevClose > 0) {
    const atrPct = atr / prevClose;
    volScale = Math.min(1, 0.02 / atrPct);
  }

  const addr = ctx.data('addr');
  const addrAvg = ctx.data('addr_sma30');
  let usageUp = true;
  if (addr != null && addrAvg != null) usageUp = addr >= addrAvg;

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const stop = ctx.entryPx * 0.85;
    if (price <= stop) return { side: 'sell', qty: pos };
    if (prevClose < ema200) return { side: 'sell', qty: pos };
    if (mom30 < 0) return { side: 'sell', qty: pos };
    // NEW: exit when network usage fades below its 30d average while holding.
    if (addr != null && addrAvg != null && addr < addrAvg) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '15% stop' },
               { side: 'sell', price: ema200, trigger: 'below', note: '200d trend break',
                 conds: [{ label: 'usage >= 30d avg', ok: usageUp, closed: true }] }]);
    return null;
  }

  const uptrend = prevClose > ema200;
  ctx.watch([{ side: 'buy', price: ema200, trigger: 'above', note: 'close above 200d EMA',
    conds: [{ label: '30d return > 0', ok: mom30 > 0, closed: true },
            { label: 'close > 200-EMA', ok: uptrend, closed: true },
            { label: 'active addr >= 30d avg', ok: usageUp, closed: true }] }]);
  if (!uptrend || !(mom30 > 0) || !usageUp) return null;

  const targetCash = ctx.cash * volScale;
  const qty = (targetCash / price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
