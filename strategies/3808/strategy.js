/*
 * @coinsori-strategy v1
 * name: DollarRegimeTrend
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin is a risk asset that tends to rise when the US dollar is
 * weak and stall when the dollar strengthens. This strategy only buys BTC when the
 * longer price trend is up AND the dollar index is below a fixed weak-dollar level
 * (a risk-on macro regime).
 * When it buys and sells: Buys when price is above its 200-day average and the
 * trade-weighted dollar index (dxy) is below 115 (both on closed bars). Sells when
 * price falls below its 200-day average or on a 20% hard stop from entry.
 * When it does NOT work: In a dollar rally that also drags BTC down it stays mostly
 * in cash (safe, but misses BTC rallies that happen despite a strong dollar). Daily
 * data is slow, so it lags sharp moves and gives back part of each trend on exit.
 */

function onUpdate(ctx) {
  const price = ctx.price;
  const sma200 = ctx.sma(200, 1); // closed-bar long-term regime (entry AND exit line)
  if (sma200 == null) return null;

  const dxy = ctx.data('dxy');
  // fixed weak-dollar regime: Fed broad index is Jan 2006 = 100, so 115 is
  // meaningfully below the ~120 of a strong dollar; above 115 = risk-off.
  if (dxy == null) return null;
  const weakDollar = dxy < 115;

  const pos = ctx.position || 0;
  const stop = ctx.entryPx != null ? ctx.entryPx * 0.80 : null; // 20% hard stop: daily swings can be large, 10% whipsaws

  ctx.watch([
    { side:'buy', price: sma200, trigger:'above', note:'SMA200 break up',
      conds:[{ label:'dollar below 115', now: dxy, op:'<', ref:115, closed:true }] },
    { side:'sell', price: sma200, trigger:'below', note:'SMA200 break down' },
    { side:'sell', price: stop, trigger:'below', note:'hard stop 20%' }
  ]);

  if (pos === 0) {
    if (price > sma200 && weakDollar) {
      return { side:'buy', qty: ctx.cash / price * 0.99 };
    }
    return null;
  }

  if (stop != null && price <= stop) return { side:'sell', qty: pos };
  if (price < sma200) return { side:'sell', qty: pos };
  return null;
}
