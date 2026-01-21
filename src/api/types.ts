import Decimal from 'decimal.js';
import { MarketplaceCode } from '../models/product.js';

export interface AmazonFeeApiConfig {
  apiKey: string;
  apiUrl: string;
  timeout?: number;
}

export interface ProductCostData {
  asin: string;
  marketplace: MarketplaceCode;
  costPrice: Decimal;
  category: string;
  productWeight?: Decimal;
  productDimensions?: {
    length: Decimal;
    width: Decimal;
    height: Decimal;
  };
  isMedia?: boolean;
}

export interface FeeApiResponse {
  success: boolean;
  data?: {
    referralFee: Decimal;
    fulfillmentFee: Decimal;
    storageFee: Decimal;
    vat: Decimal;
    shippingCost: Decimal;
    total: Decimal;
  };
  error?: string;
}
