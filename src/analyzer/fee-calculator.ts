import Decimal from 'decimal.js';
import { FeeBreakdown, FulfillmentType } from '../models/deal.js';
import { MarketplaceCode } from '../models/product.js';

export interface FeeCalculationParams {
  salePrice: Decimal;
  category: string;
  fulfillmentType: FulfillmentType;
  marketplace: MarketplaceCode;
  productWeight?: Decimal; // in kg
  productDimensions?: {
    length: Decimal; // cm
    width: Decimal; // cm
    height: Decimal; // cm
  };
  isMedia?: boolean;
}

export interface FeeRates {
  referralFee: number; // percentage
  closingFee: Decimal;
  fbaFees: {
    smallStandard: Decimal;
    standard: Decimal;
    largeStandard: Decimal;
    specialOversize: Decimal;
  };
  fbaWeightFee: Decimal; // per kg
  vatRate: number; // percentage
}

export class FeeCalculator {
  private static readonly REFERRAL_FEES: Record<string, number> = {
    default: 0.15,
    'Consumer Electronics': 0.08,
    'Computers': 0.07,
    'Camera & Photo': 0.08,
    'Home & Garden': 0.15,
    'Toys & Games': 0.15,
    'Sports & Outdoors': 0.15,
    'Books': 0.15,
    'Music': 0.15,
    'DVD & Blu-ray': 0.15,
    'Software': 0.15,
    'Video Games': 0.15,
    'Kitchen': 0.15,
    'Pet Supplies': 0.15,
    'Baby': 0.15,
    'Health & Personal Care': 0.15,
    'Beauty': 0.15,
    'Clothing': 0.17,
    'Shoes & Jewelry': 0.17,
    'Watches': 0.16,
    'Automotive': 0.12,
    'Tools & Home Improvement': 0.15,
    'Grocery': 0.15,
  };

  private static readonly VAT_RATES: Record<MarketplaceCode, number> = {
    DE: 0.19,
    FR: 0.20,
    IT: 0.22,
    ES: 0.21,
  };

  private static readonly CLOSING_FEES: Record<MarketplaceCode, Decimal> = {
    DE: new Decimal('0.99'),
    FR: new Decimal('0.99'),
    IT: new Decimal('0.99'),
    ES: new Decimal('0.99'),
  };

  private static readonly FBA_FEES: Record<MarketplaceCode, FeeRates['fbaFees']> = {
    DE: {
      smallStandard: new Decimal('2.50'),
      standard: new Decimal('3.22'),
      largeStandard: new Decimal('4.75'),
      specialOversize: new Decimal('8.50'),
    },
    FR: {
      smallStandard: new Decimal('2.50'),
      standard: new Decimal('3.22'),
      largeStandard: new Decimal('4.75'),
      specialOversize: new Decimal('8.50'),
    },
    IT: {
      smallStandard: new Decimal('2.50'),
      standard: new Decimal('3.22'),
      largeStandard: new Decimal('4.75'),
      specialOversize: new Decimal('8.50'),
    },
    ES: {
      smallStandard: new Decimal('2.50'),
      standard: new Decimal('3.22'),
      largeStandard: new Decimal('4.75'),
      specialOversize: new Decimal('8.50'),
    },
  };

  private static readonly FBA_WEIGHT_FEE: Decimal = new Decimal('0.42'); // per kg

  calculateFees(params: FeeCalculationParams): FeeBreakdown {
    const { salePrice, category, fulfillmentType, marketplace, productWeight, productDimensions, isMedia } = params;

    // Calculate referral fee
    const referralFeeRate = FeeCalculator.REFERRAL_FEES[category] || FeeCalculator.REFERRAL_FEES.default;
    const referralFee = salePrice.mul(referralFeeRate);

    // Calculate closing fee (only for media products)
    const closingFee = isMedia ? FeeCalculator.CLOSING_FEES[marketplace] : new Decimal(0);

    // Calculate fulfillment fee
    let fulfillmentFee = new Decimal(0);
    if (fulfillmentType === 'FBA') {
      fulfillmentFee = this.calculateFBAFee(marketplace, productWeight, productDimensions);
    }

    // Calculate storage fee (simplified - actual fees vary by tier and season)
    const storageFee = this.calculateStorageFee(fulfillmentType, productDimensions);

    // Calculate VAT
    const vatRate = FeeCalculator.VAT_RATES[marketplace];
    const vat = salePrice.mul(vatRate);

    // Calculate shipping cost (for FBM)
    const shippingCost = fulfillmentType === 'FBM' ? this.calculateShippingCost(productWeight, productDimensions) : new Decimal(0);

    const total = referralFee.add(closingFee).add(fulfillmentFee).add(storageFee).add(vat).add(shippingCost);

    return {
      referralFee,
      fulfillmentFee,
      storageFee,
      vat,
      shippingCost,
      total,
    };
  }

  private calculateFBAFee(marketplace: MarketplaceCode, weight?: Decimal, dimensions?: { length: Decimal; width: Decimal; height: Decimal }): Decimal {
    const fbaFees = FeeCalculator.FBA_FEES[marketplace];
    let baseFee = fbaFees.standard;

    if (dimensions) {
      const volume = dimensions.length.mul(dimensions.width).mul(dimensions.height);
      const longestSide = Decimal.max(dimensions.length, dimensions.width, dimensions.height);
      const medianSide = [dimensions.length, dimensions.width, dimensions.height].sort((a, b) => a.minus(b).toNumber())[1];
      const shortestSide = [dimensions.length, dimensions.width, dimensions.height].sort((a, b) => a.minus(b).toNumber())[0];

      // Determine tier based on dimensions
      if (volume.lte(1600) && longestSide.lte(45) && medianSide.lte(35) && shortestSide.lte(20) && (weight?.lte(1) ?? true)) {
        baseFee = fbaFees.smallStandard;
      } else if (longestSide.lte(61) && medianSide.lte(46) && shortestSide.lte(46)) {
        baseFee = fbaFees.standard;
      } else if (longestSide.lte(120) && medianSide.lte(60) && shortestSide.lte(60)) {
        baseFee = fbaFees.largeStandard;
      } else {
        baseFee = fbaFees.specialOversize;
      }
    }

    // Add weight fee
    let weightFee = new Decimal(0);
    if (weight && weight.gt(1)) {
      const extraWeight = weight.minus(1);
      weightFee = extraWeight.mul(FeeCalculator.FBA_WEIGHT_FEE);
    }

    return baseFee.add(weightFee);
  }

  private calculateStorageFee(fulfillmentType: FulfillmentType, dimensions?: { length: Decimal; width: Decimal; height: Decimal }): Decimal {
    if (fulfillmentType !== 'FBA') {
      return new Decimal(0);
    }

    // Simplified storage fee calculation
    // Actual fees vary by tier (standard vs oversize) and season
    const baseStorageFee = new Decimal('0.26'); // per cubic meter per month (simplified)

    if (dimensions) {
      const volume = dimensions.length.mul(dimensions.width).mul(dimensions.height).div(1000000); // convert cm³ to m³
      return volume.mul(baseStorageFee);
    }

    return new Decimal('0.10'); // Default small item storage fee
  }

  private calculateShippingCost(weight?: Decimal, dimensions?: { length: Decimal; width: Decimal; height: Decimal }): Decimal {
    // Simplified shipping cost calculation for FBM
    // Actual costs depend on carrier and service level
    const baseShipping = new Decimal('3.50');

    if (weight && weight.gt(0.5)) {
      const extraWeight = weight.minus(0.5);
      const weightFee = extraWeight.mul(new Decimal('1.50'));
      return baseShipping.add(weightFee);
    }

    return baseShipping;
  }

  getReferralFeeRate(category: string): number {
    return FeeCalculator.REFERRAL_FEES[category] || FeeCalculator.REFERRAL_FEES.default;
  }

  getVATRate(marketplace: MarketplaceCode): number {
    return FeeCalculator.VAT_RATES[marketplace];
  }
}
