import Decimal from 'decimal.js';
import { ProductData } from '../models/product.js';
import { Deal } from '../models/deal.js';
import { PriceHistoryManager, PriceChangeAlert } from './price-history.js';
import { DealFilterManager } from './deal-filter.js';
import { TrackingConfig } from './types.js';
import { logger } from '../utils/logger.js';

export class DealTracker {
  private priceHistoryManager: PriceHistoryManager;
  private dealFilterManager: DealFilterManager;
  private trackedDeals: Map<string, Deal> = new Map();

  constructor(private config: TrackingConfig) {
    this.priceHistoryManager = new PriceHistoryManager();
    this.dealFilterManager = new DealFilterManager();
  }

  trackProduct(product: ProductData): PriceChangeAlert | null {
    const entry = {
      asin: product.asin,
      marketplace: product.marketplace,
      price: product.price,
      timestamp: product.timestamp,
    };

    return this.priceHistoryManager.addPriceEntry(entry);
  }

  trackDeal(deal: Deal): void {
    const key = this.getDealKey(deal);
    this.trackedDeals.set(key, deal);

    // Also track the product price
    this.trackProduct(deal.product);

    logger.debug(`Deal tracked: ${deal.product.asin} (${deal.tier})`);
  }

  getDeal(asin: string, marketplace: string): Deal | null {
    const key = `${asin}:${marketplace}`;
    return this.trackedDeals.get(key) || null;
  }

  getAllDeals(): Deal[] {
    return Array.from(this.trackedDeals.values());
  }

  getPriceHistory(asin: string, marketplace: string, limit?: number) {
    return this.priceHistoryManager.getPriceHistory(asin, marketplace as any, limit);
  }

  getLastPrice(asin: string, marketplace: string): Decimal | null {
    return this.priceHistoryManager.getLastPrice(asin, marketplace as any);
  }

  getAveragePrice(asin: string, marketplace: string, days: number = 30): Decimal | null {
    return this.priceHistoryManager.getAveragePrice(asin, marketplace as any, days);
  }

  getLowestPrice(asin: string, marketplace: string, days: number = 30): Decimal | null {
    return this.priceHistoryManager.getLowestPrice(asin, marketplace as any, days);
  }

  getHighestPrice(asin: string, marketplace: string, days: number = 30): Decimal | null {
    return this.priceHistoryManager.getHighestPrice(asin, marketplace as any, days);
  }

  filterDeals(filter: any): Deal[] {
    return this.dealFilterManager.filter(this.getAllDeals(), filter);
  }

  getTopDeals(count: number, sortBy: 'margin' | 'roi' | 'profit' = 'margin'): Deal[] {
    return this.dealFilterManager.getTopDeals(this.getAllDeals(), count, sortBy);
  }

  getDealsByTier(tier: 'low' | 'medium' | 'high'): Deal[] {
    return this.dealFilterManager.getDealsByTier(this.getAllDeals(), tier);
  }

  getDealsByMarketplace(marketplace: string): Deal[] {
    return this.dealFilterManager.getDealsByMarketplace(this.getAllDeals(), marketplace);
  }

  clearDeal(asin: string, marketplace: string): void {
    const key = `${asin}:${marketplace}`;
    this.trackedDeals.delete(key);
    this.priceHistoryManager.clearHistory(asin, marketplace as any);
    logger.debug(`Deal cleared: ${asin} (${marketplace})`);
  }

  clearAllDeals(): void {
    this.trackedDeals.clear();
    this.priceHistoryManager.clearAllHistory();
    logger.debug('All deals cleared');
  }

  getTrackedDealsCount(): number {
    return this.trackedDeals.size;
  }

  getTrackedProductsCount(): number {
    return this.priceHistoryManager.getTrackedProductsCount();
  }

  private getDealKey(deal: Deal): string {
    return `${deal.product.asin}:${deal.product.marketplace}`;
  }
}
