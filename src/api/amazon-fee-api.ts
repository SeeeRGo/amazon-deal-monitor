import axios, { AxiosInstance } from 'axios';
import Decimal from 'decimal.js';
import { AmazonFeeApiConfig, ProductCostData, FeeApiResponse } from './types.js';
import { logger } from '../utils/logger.js';

export class AmazonFeeApiClient {
  private client: AxiosInstance;

  constructor(private config: AmazonFeeApiConfig) {
    this.client = axios.create({
      baseURL: config.apiUrl,
      timeout: config.timeout || 10000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
    });
  }

  async getProductCost(asin: string, marketplace: string): Promise<ProductCostData | null> {
    try {
      logger.debug(`Fetching product cost for ${asin} (${marketplace})`);

      const response = await this.client.get(`/products/${asin}`, {
        params: { marketplace },
      });

      if (response.data && response.data.success) {
        const data = response.data.data;

        return {
          asin: data.asin,
          marketplace: data.marketplace,
          costPrice: new Decimal(data.costPrice),
          category: data.category || 'default',
          productWeight: data.productWeight ? new Decimal(data.productWeight) : undefined,
          productDimensions: data.productDimensions ? {
            length: new Decimal(data.productDimensions.length),
            width: new Decimal(data.productDimensions.width),
            height: new Decimal(data.productDimensions.height),
          } : undefined,
          isMedia: data.isMedia || false,
        };
      }

      logger.warn(`Failed to fetch product cost for ${asin}: ${response.data?.error || 'Unknown error'}`);
      return null;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        logger.error(`API error fetching product cost for ${asin}: ${error.message}`);
      } else {
        logger.error(`Error fetching product cost for ${asin}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      return null;
    }
  }

  async calculateFees(productCost: ProductCostData): Promise<FeeApiResponse> {
    try {
      logger.debug(`Calculating fees for ${productCost.asin}`);

      const response = await this.client.post('/fees/calculate', {
        asin: productCost.asin,
        marketplace: productCost.marketplace,
        costPrice: productCost.costPrice.toString(),
        category: productCost.category,
        productWeight: productCost.productWeight?.toString(),
        productDimensions: productCost.productDimensions ? {
          length: productCost.productDimensions.length.toString(),
          width: productCost.productDimensions.width.toString(),
          height: productCost.productDimensions.height.toString(),
        } : undefined,
        isMedia: productCost.isMedia,
      });

      if (response.data && response.data.success) {
        const data = response.data.data;

        return {
          success: true,
          data: {
            referralFee: new Decimal(data.referralFee),
            fulfillmentFee: new Decimal(data.fulfillmentFee),
            storageFee: new Decimal(data.storageFee),
            vat: new Decimal(data.vat),
            shippingCost: new Decimal(data.shippingCost),
            total: new Decimal(data.total),
          },
        };
      }

      return {
        success: false,
        error: response.data?.error || 'Failed to calculate fees',
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        logger.error(`API error calculating fees for ${productCost.asin}: ${error.message}`);
        return {
          success: false,
          error: `API error: ${error.message}`,
        };
      } else {
        logger.error(`Error calculating fees for ${productCost.asin}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  }

  async getProductCostBatch(asins: string[], marketplace: string): Promise<Map<string, ProductCostData>> {
    const results = new Map<string, ProductCostData>();

    // Process in parallel with a limit
    const batchSize = 10;
    for (let i = 0; i < asins.length; i += batchSize) {
      const batch = asins.slice(i, i + batchSize);
      const promises = batch.map(async (asin) => {
        const cost = await this.getProductCost(asin, marketplace);
        if (cost) {
          results.set(asin, cost);
        }
      });

      await Promise.all(promises);
    }

    logger.info(`Fetched product costs for ${results.size}/${asins.length} ASINs`);
    return results;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.status === 200 && response.data?.status === 'ok';
    } catch (error) {
      logger.error(`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }
}
