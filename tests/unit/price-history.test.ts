import { describe, it, expect, beforeEach } from 'vitest';
import Decimal from 'decimal.js';
import { PriceHistoryManager } from '../../src/tracker/price-history.js';

describe('PriceHistoryManager', () => {
  let priceHistoryManager: PriceHistoryManager;

  beforeEach(() => {
    priceHistoryManager = new PriceHistoryManager();
  });

  it('should add price entry and return null for first entry', () => {
    const alert = priceHistoryManager.addPriceEntry({
      asin: 'B08N5WRWNW',
      marketplace: 'DE',
      price: new Decimal('100'),
      timestamp: new Date(),
    });

    expect(alert).toBeNull();
  });

  it('should detect price change when price changes', () => {
    // Add first price
    priceHistoryManager.addPriceEntry({
      asin: 'B08N5WRWNW',
      marketplace: 'DE',
      price: new Decimal('100'),
      timestamp: new Date(),
    });

    // Add second price (different)
    const alert = priceHistoryManager.addPriceEntry({
      asin: 'B08N5WRWNW',
      marketplace: 'DE',
      price: new Decimal('90'),
      timestamp: new Date(),
    });

    expect(alert).not.toBeNull();
    expect(alert!.oldPrice.toString()).toBe('100');
    expect(alert!.newPrice.toString()).toBe('90');
    expect(alert!.changeAmount.toString()).toBe('-10');
    expect(alert!.changePercentage).toBe(-10);
  });

  it('should return null when price does not change', () => {
    // Add first price
    priceHistoryManager.addPriceEntry({
      asin: 'B08N5WRWNW',
      marketplace: 'DE',
      price: new Decimal('100'),
      timestamp: new Date(),
    });

    // Add second price (same)
    const alert = priceHistoryManager.addPriceEntry({
      asin: 'B08N5WRWNW',
      marketplace: 'DE',
      price: new Decimal('100'),
      timestamp: new Date(),
    });

    expect(alert).toBeNull();
  });

  it('should return price history for a product', () => {
    const asin = 'B08N5WRWNW';
    const marketplace = 'DE';

    priceHistoryManager.addPriceEntry({
      asin,
      marketplace,
      price: new Decimal('100'),
      timestamp: new Date('2024-01-01'),
    });

    priceHistoryManager.addPriceEntry({
      asin,
      marketplace,
      price: new Decimal('90'),
      timestamp: new Date('2024-01-02'),
    });

    priceHistoryManager.addPriceEntry({
      asin,
      marketplace,
      price: new Decimal('95'),
      timestamp: new Date('2024-01-03'),
    });

    const history = priceHistoryManager.getPriceHistory(asin, marketplace);

    expect(history).toHaveLength(3);
    expect(history[0].price.toString()).toBe('100');
    expect(history[1].price.toString()).toBe('90');
    expect(history[2].price.toString()).toBe('95');
  });

  it('should return last price for a product', () => {
    const asin = 'B08N5WRWNW';
    const marketplace = 'DE';

    priceHistoryManager.addPriceEntry({
      asin,
      marketplace,
      price: new Decimal('100'),
      timestamp: new Date(),
    });

    priceHistoryManager.addPriceEntry({
      asin,
      marketplace,
      price: new Decimal('90'),
      timestamp: new Date(),
    });

    const lastPrice = priceHistoryManager.getLastPrice(asin, marketplace);

    expect(lastPrice).not.toBeNull();
    expect(lastPrice!.toString()).toBe('90');
  });

  it('should return null for product with no history', () => {
    const lastPrice = priceHistoryManager.getLastPrice('B08N5WRWNW', 'DE');
    expect(lastPrice).toBeNull();
  });

  it('should calculate average price correctly', () => {
    const asin = 'B08N5WRWNW';
    const marketplace = 'DE';

    priceHistoryManager.addPriceEntry({
      asin,
      marketplace,
      price: new Decimal('100'),
      timestamp: new Date(),
    });

    priceHistoryManager.addPriceEntry({
      asin,
      marketplace,
      price: new Decimal('90'),
      timestamp: new Date(),
    });

    priceHistoryManager.addPriceEntry({
      asin,
      marketplace,
      price: new Decimal('95'),
      timestamp: new Date(),
    });

    const avgPrice = priceHistoryManager.getAveragePrice(asin, marketplace);

    expect(avgPrice).not.toBeNull();
    expect(avgPrice!.toString()).toBe('95'); // (100 + 90 + 95) / 3 = 95
  });

  it('should return lowest price correctly', () => {
    const asin = 'B08N5WRWNW';
    const marketplace = 'DE';

    priceHistoryManager.addPriceEntry({
      asin,
      marketplace,
      price: new Decimal('100'),
      timestamp: new Date(),
    });

    priceHistoryManager.addPriceEntry({
      asin,
      marketplace,
      price: new Decimal('90'),
      timestamp: new Date(),
    });

    priceHistoryManager.addPriceEntry({
      asin,
      marketplace,
      price: new Decimal('95'),
      timestamp: new Date(),
    });

    const lowestPrice = priceHistoryManager.getLowestPrice(asin, marketplace);

    expect(lowestPrice).not.toBeNull();
    expect(lowestPrice!.toString()).toBe('90');
  });

  it('should return highest price correctly', () => {
    const asin = 'B08N5WRWNW';
    const marketplace = 'DE';

    priceHistoryManager.addPriceEntry({
      asin,
      marketplace,
      price: new Decimal('100'),
      timestamp: new Date(),
    });

    priceHistoryManager.addPriceEntry({
      asin,
      marketplace,
      price: new Decimal('90'),
      timestamp: new Date(),
    });

    priceHistoryManager.addPriceEntry({
      asin,
      marketplace,
      price: new Decimal('95'),
      timestamp: new Date(),
    });

    const highestPrice = priceHistoryManager.getHighestPrice(asin, marketplace);

    expect(highestPrice).not.toBeNull();
    expect(highestPrice!.toString()).toBe('100');
  });

  it('should clear history for a product', () => {
    const asin = 'B08N5WRWNW';
    const marketplace = 'DE';

    priceHistoryManager.addPriceEntry({
      asin,
      marketplace,
      price: new Decimal('100'),
      timestamp: new Date(),
    });

    priceHistoryManager.clearHistory(asin, marketplace);

    const history = priceHistoryManager.getPriceHistory(asin, marketplace);
    expect(history).toHaveLength(0);
  });

  it('should return tracked products count', () => {
    priceHistoryManager.addPriceEntry({
      asin: 'B08N5WRWNW',
      marketplace: 'DE',
      price: new Decimal('100'),
      timestamp: new Date(),
    });

    priceHistoryManager.addPriceEntry({
      asin: 'B08N5WRWNW',
      marketplace: 'FR',
      price: new Decimal('100'),
      timestamp: new Date(),
    });

    priceHistoryManager.addPriceEntry({
      asin: 'B08N5WRWNX',
      marketplace: 'DE',
      price: new Decimal('100'),
      timestamp: new Date(),
    });

    expect(priceHistoryManager.getTrackedProductsCount()).toBe(3);
  });
});
