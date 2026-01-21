import Decimal from 'decimal.js';
import { ProductData, MarketplaceCode } from './product.js';

export type DealTier = 'low' | 'medium' | 'high';
export type FulfillmentType = 'FBA' | 'FBM';

export interface FeeBreakdown {
  referralFee: Decimal;
  fulfillmentFee: Decimal;
  storageFee: Decimal;
  vat: Decimal;
  shippingCost: Decimal;
  total: Decimal;
}

export interface DealMetrics {
  salePrice: Decimal;
  costPrice: Decimal;
  totalFees: Decimal;
  profit: Decimal;
  margin: number; // percentage
  roi: number; // percentage
}

export interface Deal {
  id: string;
  product: ProductData;
  metrics: DealMetrics;
  feeBreakdown: FeeBreakdown;
  tier: DealTier;
  fulfillmentType: FulfillmentType;
  detectedAt: Date;
}

export interface DealFilter {
  minMargin: number;
  minRoi: number;
  minProfit: Decimal;
  maxPrice: Decimal;
  minRating: number;
  maxSalesRank: number;
  marketplaces: MarketplaceCode[];
}

export interface DealTierConfig {
  minMargin: number;
  maxMargin?: number;
  minRoi: number;
  maxRoi?: number;
  role: string;
  color: number;
}
