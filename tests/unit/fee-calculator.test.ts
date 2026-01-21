import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import { FeeCalculator } from '../../src/analyzer/fee-calculator.js';

describe('FeeCalculator', () => {
  const feeCalculator = new FeeCalculator();

  it('should calculate referral fee correctly', () => {
    const result = feeCalculator.calculateFees({
      salePrice: new Decimal('100'),
      category: 'default',
      fulfillmentType: 'FBA',
      marketplace: 'DE',
    });

    // Default referral fee is 15%
    expect(result.referralFee.toString()).toBe('15');
  });

  it('should calculate referral fee for electronics category', () => {
    const result = feeCalculator.calculateFees({
      salePrice: new Decimal('100'),
      category: 'Consumer Electronics',
      fulfillmentType: 'FBA',
      marketplace: 'DE',
    });

    // Electronics referral fee is 8%
    expect(result.referralFee.toString()).toBe('8');
  });

  it('should calculate VAT correctly for Germany', () => {
    const result = feeCalculator.calculateFees({
      salePrice: new Decimal('100'),
      category: 'default',
      fulfillmentType: 'FBA',
      marketplace: 'DE',
    });

    // Germany VAT is 19%
    expect(result.vat.toString()).toBe('19');
  });

  it('should calculate VAT correctly for France', () => {
    const result = feeCalculator.calculateFees({
      salePrice: new Decimal('100'),
      category: 'default',
      fulfillmentType: 'FBA',
      marketplace: 'FR',
    });

    // France VAT is 20%
    expect(result.vat.toString()).toBe('20');
  });

  it('should calculate total fees correctly', () => {
    const result = feeCalculator.calculateFees({
      salePrice: new Decimal('100'),
      category: 'default',
      fulfillmentType: 'FBA',
      marketplace: 'DE',
    });

    // Total should be sum of all fees
    const expectedTotal = result.referralFee
      .add(result.fulfillmentFee)
      .add(result.storageFee)
      .add(result.vat)
      .add(result.shippingCost);

    expect(result.total.toString()).toBe(expectedTotal.toString());
  });

  it('should include closing fee for media products', () => {
    const result = feeCalculator.calculateFees({
      salePrice: new Decimal('100'),
      category: 'default',
      fulfillmentType: 'FBA',
      marketplace: 'DE',
      isMedia: true,
    });

    // Closing fee should be 0.99 EUR
    expect(result.referralFee.add(result.fulfillmentFee).add(result.storageFee).add(result.vat).add(result.shippingCost).lt(result.total)).toBe(true);
  });

  it('should return correct referral fee rate for category', () => {
    const rate = feeCalculator.getReferralFeeRate('Books');
    expect(rate).toBe(0.15);
  });

  it('should return correct VAT rate for marketplace', () => {
    const rate = feeCalculator.getVATRate('IT');
    expect(rate).toBe(0.22);
  });
});
