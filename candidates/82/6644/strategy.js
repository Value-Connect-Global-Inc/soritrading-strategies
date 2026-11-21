/*
 * @coinsori-strategy v1
 * name: BTC On-Chain Gated Trend 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: on-chain network usage (daily active addresses) is an independent source of
 * information. The pure usage filter whipsawed, so here it is used only as a slow confirmation
 * gate on top of a price trend, with a hysteresis band to cut trade frequency.
 * When it buys and sells: buy when price is above its 200-bar average AND active addresses are
 * clearly above their 30-day average (usage expanding). Sell when price drops below its 50-bar
 * average OR usage clearly contracts, and always on a -15% hard stop.
 * When it does NOT work: active addresses can peak before price (they topped before the 2021 top),
 * so the gate can keep the strategy out of the final leg of a rally. In choppy bear-market bounces
 * the 200-bar gate re-enters too early and the stop takes losses.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const addr = ctx.data('addr');         // daily unique active addresses (count)
  const addr30 = ctx.data('addr_sma30'); // 30-day average of active addresses
  if (addr == null || addr30 == null) return null;

  const ema200 = ctx.ema(200, 1); // slow trend: only trade in an uptrend
  const ema50 = ctx.ema(50, 1);   // fast trend: exit when momentum breaks
  if (ema200 == null || ema50 == null) return null;

  const usage = addr / addr30; // >1 expanding, <1 contracting
  const pos = ctx.position || 0;
  const entry = ctx.entryPx;

  if (pos > 0) {
    // Hard stop: -15% cuts flash crashes before the daily usage data reacts.
    if (entry != null && price <= entry * 0.85) {
      ctx.watch([{ side:'sell', price: entry * 0.85, trigger:'below', note:'hard stop -15%' }]);
      return { side:'sell', qty: pos, reduceOnly: true };
    }
    // Exit: fast trend broke, or usage clearly contracting (hysteresis band 0.99).
    if (price < ema50 || usage < 0.99) {
      ctx.watch([
        { side:'sell', price: ema50, trigger:'below', note:'trend broke' },
        { side:'sell', price: price, trigger:'below', note:'usage contracting',
          conds:[{ label:'addr/30d', ok: usage < 0.99 }] }
      ]);
      return { side:'sell', qty: pos, reduceOnly: true };
    }
    ctx.watch([{ side:'sell', price: entry * 0.85, trigger:'below', note:'hard stop -15%' }]);
    return null;
  }

  // Entry: uptrend confirmed by price AND network usage clearly expanding (band 1.02).
  if (price > ema200 && usage > 1.02) {
    ctx.watch([{ side:'buy', price: ema200, trigger:'above', note:'uptrend + usage expanding',
      conds:[{ label:'addr/30d', ok: usage > 1.02 }] }]);
    return { side:'buy', qty: ctx.cash / price * 0.99 };
  }

  ctx.watch([]);
  return null;
}
