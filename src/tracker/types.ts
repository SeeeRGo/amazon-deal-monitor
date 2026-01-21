import Decimal from 'decimal.js';
import { MarketplaceCode } from '../models/product.js';
import { Deal } from '../models/deal.js';

export interface PriceHistoryEntry {
  asin: string;
  marketplace: MarketplaceCode;
  price: Decimal;
  timestamp: Date;
}

export interface PriceChangeAlert {
  asin: string;
  marketplace: MarketplaceCode;
  oldPrice: Decimal;
  newPrice: Decimal;
  changeAmount: Decimal;
  changePercentage: number;
  timestamp: Date;
}

export interface TrackingConfig {
  maxHistoryEntries: number;
  priceChangeThreshold: number; // percentage
  enablePriceChangeAlerts: boolean;
}
