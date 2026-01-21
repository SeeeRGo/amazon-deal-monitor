import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import { DealFilterManager } from '../../src/tracker/deal-filter.js';
import { Deal } from '../../src/models/deal.js';
import { DealFilter as DealFilterInterface } from '../../src/models/deal.js';

describe('DealFilterManager', () => {
  const dealFilter = new DealFilterManager();

  const createMockDeal = (margin: number, roi: number, price: number, rating: number, salesRank: number, marketplace: string): Deal => ({
    id: 'test-deal-1',
    product: {
      asin: 'B08N5WRWNW',
      marketplace: marketplace as any,
      title: 'Test Product',
      price: new Decimal(price),
      currency: 'EUR',
      availability: true,
      rating,
      reviewCount: 100,
      salesRank,
      seller: 'Amazon',
      isPrime: true,
      productUrl: 'https://www.amazon.de/dp/B08N5WRWNW',
      timestamp: new Date(),
    },
    metrics: {
      salePrice: new Decimal(price),
      costPrice: new Decimal(price * 0.5),
      totalFees: new Decimal(price * 0.2),
      profit: new Decimal(price * 0.3),
      margin,
      roi,
    },
    feeBreakdown: {
      referralFee: new Decimal(price * 0.15),
      fulfillmentFee: new Decimal(3),
      storageFee: new Decimal(0.5),
      vat: new Decimal(price * 0.19),
      shippingCost: new Decimal(0),
      total: new Decimal(price * 0.2),
    },
    tier: 'high',
    fulfillmentType: 'FBA',
    detectedAt: new Date(),
  });

  it('should filter deals by minimum margin', () => {
    const deals = [
      createMockDeal(20, 100, 100, 4.5, 1000, 'DE'),
      createMockDeal(30, 150, 100, 4.5, 1000, 'DE'),
      createMockDeal(40, 200, 100, 4.5, 1000, 'DE'),
    ];

    const filter: DealFilterInterface = {
      minMargin: 25,
      minRoi: 0,
      minProfit: new Decimal(0),
      maxPrice: new Decimal(1000),
      minRating: 0,
      maxSalesRank: 0,
      marketplaces: ['DE', 'FR', 'IT', 'ES'],
    };

    const filtered = dealFilter.filter(deals, filter);

    expect(filtered).toHaveLength(2);
    expect(filtered[0].metrics.margin).toBeGreaterThanOrEqual(25);
    expect(filtered[1].metrics.margin).toBeGreaterThanOrEqual(25);
  });

  it('should filter deals by minimum ROI', () => {
    const deals = [
      createMockDeal(30, 80, 100, 4.5, 1000, 'DE'),
      createMockDeal(30, 150, 100, 4.5, 1000, 'DE'),
      createMockDeal(30, 250, 100, 4.5, 1000, 'DE'),
    ];

    const filter: DealFilterInterface = {
      minMargin: 0,
      minRoi: 100,
      minProfit: new Decimal(0),
      maxPrice: new Decimal(1000),
      minRating: 0,
      maxSalesRank: 0,
      marketplaces: ['DE', 'FR', 'IT', 'ES'],
    };

    const filtered = dealFilter.filter(deals, filter);

    expect(filtered).toHaveLength(2);
    expect(filtered[0].metrics.roi).toBeGreaterThanOrEqual(100);
    expect(filtered[1].metrics.roi).toBeGreaterThanOrEqual(100);
  });

  it('should filter deals by minimum profit', () => {
    const deals = [
      createMockDeal(30, 150, 50, 4.5, 1000, 'DE'),
      createMockDeal(30, 150, 100, 4.5, 1000, 'DE'),
      createMockDeal(30, 150, 200, 4.5, 1000, 'DE'),
    ];

    const filter: DealFilterInterface = {
      minMargin: 0,
      minRoi: 0,
      minProfit: new Decimal(20),
      maxPrice: new Decimal(1000),
      minRating: 0,
      maxSalesRank: 0,
      marketplaces: ['DE', 'FR', 'IT', 'ES'],
    };

    const filtered = dealFilter.filter(deals, filter);

    expect(filtered).toHaveLength(2);
    expect(filtered[0].metrics.profit.gte(20)).toBe(true);
    expect(filtered[1].metrics.profit.gte(20)).toBe(true);
  });

  it('should filter deals by maximum price', () => {
    const deals = [
      createMockDeal(30, 150, 50, 4.5, 1000, 'DE'),
      createMockDeal(30, 150, 100, 4.5, 1000, 'DE'),
      createMockDeal(30, 150, 200, 4.5, 1000, 'DE'),
    ];

    const filter: DealFilterInterface = {
      minMargin: 0,
      minRoi: 0,
      minProfit: new Decimal(0),
      maxPrice: new Decimal(100),
      minRating: 0,
      maxSalesRank: 0,
      marketplaces: ['DE', 'FR', 'IT', 'ES'],
    };

    const filtered = dealFilter.filter(deals, filter);

    expect(filtered).toHaveLength(2);
    expect(filtered[0].product.price.lte(100)).toBe(true);
    expect(filtered[1].product.price.lte(100)).toBe(true);
  });

  it('should filter deals by minimum rating', () => {
    const deals = [
      createMockDeal(30, 150, 100, 3.5, 1000, 'DE'),
      createMockDeal(30, 150, 100, 4.0, 1000, 'DE'),
      createMockDeal(30, 150, 100, 4.5, 1000, 'DE'),
    ];

    const filter: DealFilterInterface = {
      minMargin: 0,
      minRoi: 0,
      minProfit: new Decimal(0),
      maxPrice: new Decimal(1000),
      minRating: 4.0,
      maxSalesRank: 0,
      marketplaces: ['DE', 'FR', 'IT', 'ES'],
    };

    const filtered = dealFilter.filter(deals, filter);

    expect(filtered).toHaveLength(2);
    expect(filtered[0].product.rating).toBeGreaterThanOrEqual(4.0);
    expect(filtered[1].product.rating).toBeGreaterThanOrEqual(4.0);
  });

  it('should filter deals by maximum sales rank', () => {
    const deals = [
      createMockDeal(30, 150, 100, 4.5, 500, 'DE'),
      createMockDeal(30, 150, 100, 4.5, 1500, 'DE'),
      createMockDeal(30, 150, 100, 4.5, 2500, 'DE'),
    ];

    const filter: DealFilterInterface = {
      minMargin: 0,
      minRoi: 0,
      minProfit: new Decimal(0),
      maxPrice: new Decimal(1000),
      minRating: 0,
      maxSalesRank: 1000,
      marketplaces: ['DE', 'FR', 'IT', 'ES'],
    };

    const filtered = dealFilter.filter(deals, filter);

    expect(filtered).toHaveLength(1);
    expect(filtered[0].product.salesRank).toBeLessThanOrEqual(1000);
  });

  it('should filter deals by marketplace', () => {
    const deals = [
      createMockDeal(30, 150, 100, 4.5, 1000, 'DE'),
      createMockDeal(30, 150, 100, 4.5, 1000, 'FR'),
      createMockDeal(30, 150, 100, 4.5, 1000, 'IT'),
    ];

    const filter: DealFilterInterface = {
      minMargin: 0,
      minRoi: 0,
      minProfit: new Decimal(0),
      maxPrice: new Decimal(1000),
      minRating: 0,
      maxSalesRank: 0,
      marketplaces: ['DE', 'FR'],
    };

    const filtered = dealFilter.filter(deals, filter);

    expect(filtered).toHaveLength(2);
    expect(filtered[0].product.marketplace).toBe('DE');
    expect(filtered[1].product.marketplace).toBe('FR');
  });

  it('should sort deals by margin descending', () => {
    const deals = [
      createMockDeal(20, 100, 100, 4.5, 1000, 'DE'),
      createMockDeal(40, 200, 100, 4.5, 1000, 'DE'),
      createMockDeal(30, 150, 100, 4.5, 1000, 'DE'),
    ];

    const sorted = dealFilter.sortByMargin(deals, true);

    expect(sorted[0].metrics.margin).toBe(40);
    expect(sorted[1].metrics.margin).toBe(30);
    expect(sorted[2].metrics.margin).toBe(20);
  });

  it('should sort deals by ROI descending', () => {
    const deals = [
      createMockDeal(30, 80, 100, 4.5, 1000, 'DE'),
      createMockDeal(30, 250, 100, 4.5, 1000, 'DE'),
      createMockDeal(30, 150, 100, 4.5, 1000, 'DE'),
    ];

    const sorted = dealFilter.sortByRoi(deals, true);

    expect(sorted[0].metrics.roi).toBe(250);
    expect(sorted[1].metrics.roi).toBe(150);
    expect(sorted[2].metrics.roi).toBe(80);
  });

  it('should get top deals by margin', () => {
    const deals = [
      createMockDeal(20, 100, 100, 4.5, 1000, 'DE'),
      createMockDeal(40, 200, 100, 4.5, 1000, 'DE'),
      createMockDeal(30, 150, 100, 4.5, 1000, 'DE'),
      createMockDeal(35, 175, 100, 4.5, 1000, 'DE'),
      createMockDeal(25, 125, 100, 4.5, 1000, 'DE'),
    ];

    const topDeals = dealFilter.getTopDeals(deals, 3, 'margin');

    expect(topDeals).toHaveLength(3);
    expect(topDeals[0].metrics.margin).toBe(40);
    expect(topDeals[1].metrics.margin).toBe(35);
    expect(topDeals[2].metrics.margin).toBe(30);
  });

  it('should get deals by tier', () => {
    const deals = [
      createMockDeal(20, 100, 100, 4.5, 1000, 'DE'),
      createMockDeal(40, 200, 100, 4.5, 1000, 'DE'),
      createMockDeal(30, 150, 100, 4.5, 1000, 'DE'),
    ];

    deals[0].tier = 'low';
    deals[1].tier = 'high';
    deals[2].tier = 'medium';

    const highTierDeals = dealFilter.getDealsByTier(deals, 'high');

    expect(highTierDeals).toHaveLength(1);
    expect(highTierDeals[0].tier).toBe('high');
  });

  it('should get deals by marketplace', () => {
    const deals = [
      createMockDeal(30, 150, 100, 4.5, 1000, 'DE'),
      createMockDeal(30, 150, 100, 4.5, 1000, 'FR'),
      createMockDeal(30, 150, 100, 4.5, 1000, 'DE'),
      createMockDeal(30, 150, 100, 4.5, 1000, 'IT'),
    ];

    const deDeals = dealFilter.getDealsByMarketplace(deals, 'DE');

    expect(deDeals).toHaveLength(2);
    expect(deDeals[0].product.marketplace).toBe('DE');
    expect(deDeals[1].product.marketplace).toBe('DE');
  });
});
