import Decimal from 'decimal.js';

export type MarketplaceCode = 'DE' | 'FR' | 'IT' | 'ES';

export interface Marketplace {
  code: MarketplaceCode;
  name: string;
  domain: string;
  currency: string;
  vatRate: number;
}

export interface ProductData {
  asin: string;
  marketplace: MarketplaceCode;
  title: string;
  price: Decimal;
  currency: string;
  availability: boolean;
  rating: number;
  reviewCount: number;
  salesRank: number;
  seller: string;
  isPrime: boolean;
  imageUrl?: string;
  productUrl: string;
  timestamp: Date;
}

export interface PricePoint {
  price: Decimal;
  timestamp: Date;
}

export interface PriceChange {
  asin: string;
  oldPrice: Decimal;
  newPrice: Decimal;
  changeAmount: Decimal;
  changePercentage: number;
  timestamp: Date;
}
