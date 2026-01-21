import Decimal from 'decimal.js';
import { PriceHistoryEntry, PriceChangeAlert } from './types.js';
import { MarketplaceCode } from '../models/product.js';
import { logger } from '../utils/logger.js';

export type { PriceChangeAlert } from './types.js';

export class PriceHistoryManager {
  private history: Map<string, PriceHistoryEntry[]> = new Map();
  private lastPrices: Map<string, Decimal> = new Map();

  addPriceEntry(entry: PriceHistoryEntry): PriceChangeAlert | null {
    const key = this.getKey(entry.asin, entry.marketplace);

    // Check for price change
    const lastPrice = this.lastPrices.get(key);
    let alert: PriceChangeAlert | null = null;

    if (lastPrice && !lastPrice.equals(entry.price)) {
      const changeAmount = entry.price.minus(lastPrice);
      const changePercentage = lastPrice.gt(0) ? changeAmount.div(lastPrice).mul(100).toNumber() : 0;

      alert = {
        asin: entry.asin,
        marketplace: entry.marketplace,
        oldPrice: lastPrice,
        newPrice: entry.price,
        changeAmount,
        changePercentage,
        timestamp: entry.timestamp,
      };

      logger.debug(`Price change detected for ${entry.asin}: ${lastPrice.toFixed(2)} -> ${entry.price.toFixed(2)} (${changePercentage.toFixed(2)}%)`);
    }

    // Update history
    if (!this.history.has(key)) {
      this.history.set(key, []);
    }

    const history = this.history.get(key)!;
    history.push(entry);

    // Limit history size
    if (history.length > 1000) {
      history.shift();
    }

    // Update last price
    this.lastPrices.set(key, entry.price);

    return alert;
  }

  getPriceHistory(asin: string, marketplace: MarketplaceCode, limit?: number): PriceHistoryEntry[] {
    const key = this.getKey(asin, marketplace);
    const history = this.history.get(key) || [];

    if (limit) {
      return history.slice(-limit);
    }

    return [...history];
  }

  getLastPrice(asin: string, marketplace: MarketplaceCode): Decimal | null {
    const key = this.getKey(asin, marketplace);
    return this.lastPrices.get(key) || null;
  }

  getAveragePrice(asin: string, marketplace: MarketplaceCode, days: number = 30): Decimal | null {
    const key = this.getKey(asin, marketplace);
    const history = this.history.get(key);

    if (!history || history.length === 0) {
      return null;
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const recentEntries = history.filter((entry) => entry.timestamp >= cutoffDate);

    if (recentEntries.length === 0) {
      return null;
    }

    const sum = recentEntries.reduce((acc, entry) => acc.add(entry.price), new Decimal(0));
    return sum.div(recentEntries.length);
  }

  getLowestPrice(asin: string, marketplace: MarketplaceCode, days: number = 30): Decimal | null {
    const key = this.getKey(asin, marketplace);
    const history = this.history.get(key);

    if (!history || history.length === 0) {
      return null;
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const recentEntries = history.filter((entry) => entry.timestamp >= cutoffDate);

    if (recentEntries.length === 0) {
      return null;
    }

    return recentEntries.reduce((min, entry) => entry.price.lt(min) ? entry.price : min, recentEntries[0].price);
  }

  getHighestPrice(asin: string, marketplace: MarketplaceCode, days: number = 30): Decimal | null {
    const key = this.getKey(asin, marketplace);
    const history = this.history.get(key);

    if (!history || history.length === 0) {
      return null;
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const recentEntries = history.filter((entry) => entry.timestamp >= cutoffDate);

    if (recentEntries.length === 0) {
      return null;
    }

    return recentEntries.reduce((max, entry) => entry.price.gt(max) ? entry.price : max, recentEntries[0].price);
  }

  clearHistory(asin: string, marketplace: MarketplaceCode): void {
    const key = this.getKey(asin, marketplace);
    this.history.delete(key);
    this.lastPrices.delete(key);
    logger.debug(`Price history cleared for ${asin} (${marketplace})`);
  }

  clearAllHistory(): void {
    this.history.clear();
    this.lastPrices.clear();
    logger.debug('All price history cleared');
  }

  getTrackedProductsCount(): number {
    return this.history.size;
  }

  private getKey(asin: string, marketplace: MarketplaceCode): string {
    return `${asin}:${marketplace}`;
  }
}
