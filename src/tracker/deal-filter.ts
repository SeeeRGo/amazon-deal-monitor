import Decimal from 'decimal.js';
import { Deal, DealFilter as DealFilterInterface } from '../models/deal.js';
import { logger } from '../utils/logger.js';

export class DealFilterManager {
  filter(deals: Deal[], filter: DealFilterInterface): Deal[] {
    return deals.filter((deal) => this.passesFilter(deal, filter));
  }

  passesFilter(deal: Deal, filter: DealFilterInterface): boolean {
    const { metrics, product } = deal;

    // Check minimum margin
    if (metrics.margin < filter.minMargin) {
      logger.debug(`Deal ${deal.product.asin} filtered out: margin ${metrics.margin.toFixed(2)}% < ${filter.minMargin}%`);
      return false;
    }

    // Check minimum ROI
    if (metrics.roi < filter.minRoi) {
      logger.debug(`Deal ${deal.product.asin} filtered out: ROI ${metrics.roi.toFixed(2)}% < ${filter.minRoi}%`);
      return false;
    }

    // Check minimum profit
    if (metrics.profit.lt(filter.minProfit)) {
      logger.debug(`Deal ${deal.product.asin} filtered out: profit ${metrics.profit.toFixed(2)} < ${filter.minProfit}`);
      return false;
    }

    // Check maximum price
    if (product.price.gt(filter.maxPrice)) {
      logger.debug(`Deal ${deal.product.asin} filtered out: price ${product.price.toFixed(2)} > ${filter.maxPrice}`);
      return false;
    }

    // Check minimum rating
    if (product.rating < filter.minRating) {
      logger.debug(`Deal ${deal.product.asin} filtered out: rating ${product.rating} < ${filter.minRating}`);
      return false;
    }

    // Check maximum sales rank
    if (filter.maxSalesRank > 0 && product.salesRank > filter.maxSalesRank) {
      logger.debug(`Deal ${deal.product.asin} filtered out: sales rank ${product.salesRank} > ${filter.maxSalesRank}`);
      return false;
    }

    // Check marketplace
    if (!filter.marketplaces.includes(product.marketplace)) {
      logger.debug(`Deal ${deal.product.asin} filtered out: marketplace ${product.marketplace} not in allowed list`);
      return false;
    }

    return true;
  }

  sortByMargin(deals: Deal[], descending: boolean = true): Deal[] {
    return [...deals].sort((a, b) => {
      return descending ? b.metrics.margin - a.metrics.margin : a.metrics.margin - b.metrics.margin;
    });
  }

  sortByRoi(deals: Deal[], descending: boolean = true): Deal[] {
    return [...deals].sort((a, b) => {
      return descending ? b.metrics.roi - a.metrics.roi : a.metrics.roi - b.metrics.roi;
    });
  }

  sortByProfit(deals: Deal[], descending: boolean = true): Deal[] {
    return [...deals].sort((a, b) => {
      return descending ? b.metrics.profit.minus(a.metrics.profit).toNumber() : a.metrics.profit.minus(b.metrics.profit).toNumber();
    });
  }

  sortByPrice(deals: Deal[], descending: boolean = true): Deal[] {
    return [...deals].sort((a, b) => {
      return descending ? b.product.price.minus(a.product.price).toNumber() : a.product.price.minus(b.product.price).toNumber();
    });
  }

  sortBySalesRank(deals: Deal[], ascending: boolean = true): Deal[] {
    return [...deals].sort((a, b) => {
      return ascending ? a.product.salesRank - b.product.salesRank : b.product.salesRank - a.product.salesRank;
    });
  }

  sortByRating(deals: Deal[], descending: boolean = true): Deal[] {
    return [...deals].sort((a, b) => {
      return descending ? b.product.rating - a.product.rating : a.product.rating - b.product.rating;
    });
  }

  getTopDeals(deals: Deal[], count: number, sortBy: 'margin' | 'roi' | 'profit' = 'margin'): Deal[] {
    let sorted: Deal[];

    switch (sortBy) {
      case 'margin':
        sorted = this.sortByMargin(deals);
        break;
      case 'roi':
        sorted = this.sortByRoi(deals);
        break;
      case 'profit':
        sorted = this.sortByProfit(deals);
        break;
      default:
        sorted = this.sortByMargin(deals);
    }

    return sorted.slice(0, count);
  }

  getDealsByTier(deals: Deal[], tier: 'low' | 'medium' | 'high'): Deal[] {
    return deals.filter((deal) => deal.tier === tier);
  }

  getDealsByMarketplace(deals: Deal[], marketplace: string): Deal[] {
    return deals.filter((deal) => deal.product.marketplace === marketplace);
  }
}
