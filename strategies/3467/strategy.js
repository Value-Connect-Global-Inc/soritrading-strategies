/*
 * @coinsori-strategy v1
 * name: On-Chain Active Addresses Momentum BTC 1d
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: On-chain network activity growth (active addresses) often precedes medium-term price trends in Bitcoin.
 * When it buys and sells: Buys when price is above SMA(50) and active addresses are expanding (above their 30-day SMA), sells when price drops below SMA(20).
 * When it does not work: Fails during structural network plateaus or sudden macro-driven liquidations where on-chain metrics lag price crashes.
 */

function onUpdate(ctx) {
    const price = ctx.price;
    if (price == null) return null;

    // Read indicators with guards
    const sma50 = ctx.sma(50, 1);
    const sma20 = ctx.sma(20, 1);
    if (sma50 == null || sma20 == null) return null;

    // Read on-chain active addresses and its SMA (30-day) from dataset
    const addr = ctx.data('addr');
    const addrSma = ctx.data('addr_sma30');
    if (addr == null || addrSma == null) return null;

    const pos = ctx.position;

    // Watch conditions for live/paper card
    ctx.watch([
        { side: 'buy', price: sma50, trigger: 'above', note: 'Price > SMA50 & Addr > AddrSMA',
          conds: [
              { label: 'Active Addr > SMA', ok: addr > addrSma },
              { label: 'Price > SMA50', ok: price > sma50 }
          ] },
        { side: 'sell', price: sma20, trigger: 'below', note: 'Exit below SMA20' }
    ]);

    // Entry: Price above SMA50 and active addresses above their 30-day average
    if (pos <= 0 && price > sma50 && addr > addrSma) {
        const qty = ctx.cash / price * 0.99;
        if (qty > 0) {
            return { side: 'buy', qty };
        }
    }

    // Exit: Price falls below SMA20
    if (pos > 0 && price < sma20) {
        return { side: 'sell', qty: pos };
    }

    return null;
}
