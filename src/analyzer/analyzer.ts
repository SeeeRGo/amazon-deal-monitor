import Decimal from 'decimal.js';
import { v4 as uuidv4 } from 'uuid';
import { Deal, DealMetrics, DealTier, DealTierConfig, FulfillmentType } from '../models/deal.js';
import { ProductData } from '../models/product.js';
import { FeeCalculator, FeeCalculationParams } from './fee-calculator.js';
import { DealClassifier } from './deal-classifier.js';
import { logger } from '../utils/logger.js';

export interface AnalysisOptions {
  costPrice: Decimal;
  fulfillmentType: FulfillmentType;
  category?: string;
  productWeight?: Decimal;
  productDimensions?: {
    length: Decimal;
    width: Decimal;
    height: Decimal;
  };
  isMedia?: boolean;
}

export class DealAnalyzer {
  private feeCalculator: FeeCalculator;
  private dealClassifier: DealClassifier;

  constructor(tierConfigs: Record<DealTier, DealTierConfig>) {
    this.feeCalculator = new FeeCalculator();
    this.dealClassifier = new DealClassifier(tierConfigs);
  }

  analyze(product: ProductData, options: AnalysisOptions): Deal {
    const { costPrice, fulfillmentType, category = 'default', productWeight, productDimensions, isMedia = false } = options;

    // Calculate fees
    const feeParams: FeeCalculationParams = {
      salePrice: product.price,
      category,
      fulfillmentType,
      marketplace: product.marketplace,
      productWeight,
      productDimensions,
      isMedia,
    };

    const feeBreakdown = this.feeCalculator.calculateFees(feeParams);

    // Calculate metrics
    const metrics = this.calculateMetrics(product.price, costPrice, feeBreakdown.total);

    // Create deal object
    const deal: Deal = {
      id: uuidv4(),
      product,
      metrics,
      feeBreakdown,
      tier: 'low', // Will be updated by classifier
      fulfillmentType,
      detectedAt: new Date(),
    };

    // Classify deal
    const classification = this.dealClassifier.classify(deal);
    deal.tier = classification.tier;

    logger.debug(`Analyzed deal for ${product.asin}: Tier=${deal.tier}, Margin=${metrics.margin.toFixed(2)}%, ROI=${metrics.roi.toFixed(2)}%`);

    return deal;
  }

  analyzeBatch(products: ProductData[], optionsList: AnalysisOptions[]): Deal[] {
    if (products.length !== optionsList.length) {
      throw new Error('Products and options lists must have the same length');
    }

    return products.map((product, index) => this.analyze(product, optionsList[index]));
  }

  private calculateMetrics(salePrice: Decimal, costPrice: Decimal, totalFees: Decimal): DealMetrics {
    const profit = salePrice.minus(costPrice).minus(totalFees);

    // Calculate margin: (profit / salePrice) * 100
    const margin = salePrice.gt(0) ? profit.div(salePrice).mul(100).toNumber() : 0;

    // Calculate ROI: (profit / costPrice) * 100
    const roi = costPrice.gt(0) ? profit.div(costPrice).mul(100).toNumber() : 0;

    return {
      salePrice,
      costPrice,
      totalFees,
      profit,
      margin,
      roi,
    };
  }

  getFeeCalculator(): FeeCalculator {
    return this.feeCalculator;
  }

  getDealClassifier(): DealClassifier {
    return this.dealClassifier;
  }

  updateTierConfigs(tierConfigs: Record<DealTier, DealTierConfig>): void {
    Object.entries(tierConfigs).forEach(([tier, config]) => {
      this.dealClassifier.updateTierConfig(tier as DealTier, config);
    });
  }
}
