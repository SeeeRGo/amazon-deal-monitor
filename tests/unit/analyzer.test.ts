import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import { DealAnalyzer } from '../../src/analyzer/analyzer.js';
import { DealTierConfig } from '../../src/models/deal.js';
import { ProductData } from '../../src/models/product.js';

describe('DealAnalyzer', () => {
  const tierConfigs: Record<'low' | 'medium' | 'high', DealTierConfig> = {
    low: {
      minMargin: 25,
      maxMargin: 35,
      minRoi: 100,
      maxRoi: 150,
      role: 'Low-Margin',
      color: 0xffff00,
    },
    medium: {
      minMargin: 35,
      maxMargin: 50,
      minRoi: 150,
      maxRoi: 250,
      role: 'Medium-Margin',
      color: 0xffa500,
    },
    high: {
      minMargin: 50,
      minRoi: 250,
      role: 'High-Margin',
      color: 0x00ff00,
    },
  };

  const analyzer = new DealAnalyzer(tierConfigs);

  const mockProduct: ProductData = {
    asin: 'B08N5WRWNW',
    marketplace: 'DE',
    title: 'Test Product',
    price: new Decimal('100'),
    currency: 'EUR',
    availability: true,
    rating: 4.5,
    reviewCount: 100,
    salesRank: 1000,
    seller: 'Amazon',
    isPrime: true,
    productUrl: 'https://www.amazon.de/dp/B08N5WRWNW',
    timestamp: new Date(),
  };

  it('should analyze a deal and calculate metrics correctly', () => {
    const deal = analyzer.analyze(mockProduct, {
      costPrice: new Decimal('50'),
      fulfillmentType: 'FBA',
      category: 'default',
    });

    expect(deal).toBeDefined();
    expect(deal.product.asin).toBe('B08N5WRWNW');
    expect(deal.metrics.salePrice.toString()).toBe('100');
    expect(deal.metrics.costPrice.toString()).toBe('50');
    expect(deal.metrics.profit.gt(0)).toBe(true);
  });

  it('should classify deal as high tier when margin >= 50%', () => {
    const deal = analyzer.analyze(mockProduct, {
      costPrice: new Decimal('40'),
      fulfillmentType: 'FBA',
      category: 'default',
    });

    expect(deal.tier).toBe('high');
  });

  it('should classify deal as medium tier when margin between 35% and 50%', () => {
    const deal = analyzer.analyze(mockProduct, {
      costPrice: new Decimal('55'),
      fulfillmentType: 'FBA',
      category: 'default',
    });

    expect(deal.tier).toBe('medium');
  });

  it('should classify deal as low tier when margin between 25% and 35%', () => {
    const deal = analyzer.analyze(mockProduct, {
      costPrice: new Decimal('70'),
      fulfillmentType: 'FBA',
      category: 'default',
    });

    expect(deal.tier).toBe('low');
  });

  it('should calculate margin correctly', () => {
    const deal = analyzer.analyze(mockProduct, {
      costPrice: new Decimal('50'),
      fulfillmentType: 'FBA',
      category: 'default',
    });

    // Margin = (profit / salePrice) * 100
    // With fees, profit will be less than 50, so margin should be less than 50%
    expect(deal.metrics.margin).toBeGreaterThan(0);
    expect(deal.metrics.margin).toBeLessThan(50);
  });

  it('should calculate ROI correctly', () => {
    const deal = analyzer.analyze(mockProduct, {
      costPrice: new Decimal('50'),
      fulfillmentType: 'FBA',
      category: 'default',
    });

    // ROI = (profit / costPrice) * 100
    expect(deal.metrics.roi).toBeGreaterThan(0);
  });
});
