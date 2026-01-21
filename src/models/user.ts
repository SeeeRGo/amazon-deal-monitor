import Decimal from 'decimal.js';
import { MarketplaceCode } from './product.js';

export interface Thresholds {
  minMargin: number;
  minRoi: number;
  minProfit: Decimal;
}

export interface UserPreferences {
  userId: string;
  thresholds: Thresholds;
  enabledMarketplaces: MarketplaceCode[];
  enabledDealTiers: ('low' | 'medium' | 'high')[];
  enableNotifications: boolean;
}

export interface WatchlistItem {
  asin: string;
  addedAt: Date;
  userId: string;
}

export interface CategoryWatchlistItem {
  url: string;
  marketplace: MarketplaceCode;
  addedAt: Date;
  userId: string;
}
