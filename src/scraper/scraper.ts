import { chromium, Browser, Page, BrowserContext } from 'playwright';
import Decimal from 'decimal.js';
import Bottleneck from 'bottleneck';
import { logger } from '../utils/logger.js';
import { ScraperConfig, ScrapingResult, ProductScrapeData, CategoryScrapeData, ScrapingStats } from './types.js';
import { ProxyManager } from './proxy-manager.js';
import { UserAgentManager } from './user-agent-manager.js';
import { MarketplaceCode } from '../models/product.js';

export class AmazonScraper {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private limiter: Bottleneck;
  private stats: ScrapingStats = {
    totalScrapes: 0,
    successfulScrapes: 0,
    failedScrapes: 0,
    averageDuration: 0,
    lastScrapeTime: new Date(),
  };

  constructor(
    private config: ScraperConfig,
    private proxyManager?: ProxyManager,
    private userAgentManager?: UserAgentManager
  ) {
    this.limiter = new Bottleneck({
      maxConcurrent: 5,
      minTime: 1000,
    });
  }

  async initialize(): Promise<void> {
    if (this.browser) {
      return;
    }

    logger.info('Initializing Amazon scraper...');

    const launchOptions: any = {
      headless: this.config.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
      ],
    };

    const proxy = this.config.useProxies ? this.proxyManager?.getNextProxy() : null;
    if (proxy) {
      launchOptions.proxy = {
        server: `${proxy.protocol}://${proxy.host}:${proxy.port}`,
        username: proxy.username,
        password: proxy.password,
      };
      logger.info(`Using proxy: ${proxy.host}:${proxy.port}`);
    }

    this.browser = await chromium.launch(launchOptions);

    const userAgent = this.config.rotateUserAgents
      ? this.userAgentManager?.getRandomUserAgent()
      : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

    this.context = await this.browser.newContext({
      userAgent,
      viewport: { width: 1920, height: 1080 },
      locale: 'en-US',
      timezoneId: 'America/New_York',
    });

    // Set additional headers to look more like a real browser
    await this.context.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    });

    logger.info('Amazon scraper initialized successfully');
  }

  async scrapeProduct(asin: string, marketplace: MarketplaceCode): Promise<ScrapingResult<ProductScrapeData>> {
    return this.limiter.schedule(async () => {
      const startTime = Date.now();
      this.stats.totalScrapes++;

      for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
        try {
          await this.initialize();

          if (!this.context) {
            throw new Error('Browser context not initialized');
          }

          const page = await this.context.newPage();
          page.setDefaultTimeout(this.config.timeout);

          const url = this.buildProductUrl(asin, marketplace);
          logger.debug(`Scraping product: ${url} (attempt ${attempt + 1})`);

          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: this.config.timeout });

          // Check for CAPTCHA
          const captcha = await page.$('form[action*="/errors/validateCaptcha"]');
          if (captcha) {
            logger.warn(`CAPTCHA detected for ASIN ${asin}, attempt ${attempt + 1}`);
            await page.close();
            if (attempt < this.config.maxRetries) {
              await this.sleep(2000 * (attempt + 1));
              continue;
            }
            throw new Error('CAPTCHA detected and max retries exceeded');
          }

          // Check for page errors (404, product not found, etc.)
          const pageError = await page.$('#centerCol h1');
          if (pageError) {
            const errorText = await pageError.textContent() || '';
            if (errorText.includes('not found') || errorText.includes('Sorry') || errorText.includes('Page not found')) {
              await page.close();
              return {
                success: false,
                error: 'Product not found',
                retryCount: attempt,
                duration: Date.now() - startTime,
              };
            }
          }

          // Wait for product title to appear with multiple selectors
          const titleSelectors = [
            '#productTitle',
            '#centerCol #productTitle',
            'h1#productTitle',
            '.product-title',
          ];
          
          let productTitleFound = false;
          for (const selector of titleSelectors) {
            try {
              await page.waitForSelector(selector, { timeout: 5000 });
              productTitleFound = true;
              break;
            } catch {
              continue;
            }
          }

          if (!productTitleFound) {
            await page.close();
            return {
              success: false,
              error: 'Product not found',
              retryCount: attempt,
              duration: Date.now() - startTime,
            };
          }

          const data = await this.extractProductData(page, asin, marketplace);
          await page.close();

          this.stats.successfulScrapes++;
          this.updateStats(Date.now() - startTime);

          return {
            success: true,
            data,
            retryCount: attempt,
            duration: Date.now() - startTime,
          };
        } catch (error) {
          logger.error(`Error scraping product ${asin} (attempt ${attempt + 1}): ${error instanceof Error ? error.message : 'Unknown error'}`);

          if (attempt === this.config.maxRetries) {
            this.stats.failedScrapes++;
            this.updateStats(Date.now() - startTime);
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
              retryCount: attempt,
              duration: Date.now() - startTime,
            };
          }

          await this.sleep(1000 * (attempt + 1));
        }
      }

      return {
        success: false,
        error: 'Max retries exceeded',
        retryCount: this.config.maxRetries,
        duration: Date.now() - startTime,
      };
    });
  }

  async scrapeCategory(categoryUrl: string, marketplace: MarketplaceCode, maxProducts: number = 50): Promise<ScrapingResult<CategoryScrapeData>> {
    return this.limiter.schedule(async () => {
      const startTime = Date.now();
      this.stats.totalScrapes++;

      for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
        try {
          await this.initialize();

          if (!this.context) {
            throw new Error('Browser context not initialized');
          }

          const page = await this.context.newPage();
          page.setDefaultTimeout(this.config.timeout);

          logger.debug(`Scraping category: ${categoryUrl} (attempt ${attempt + 1})`);

          await page.goto(categoryUrl, { waitUntil: 'domcontentloaded', timeout: this.config.timeout });

          // Check for CAPTCHA
          const captcha = await page.$('form[action*="/errors/validateCaptcha"]');
          if (captcha) {
            logger.warn(`CAPTCHA detected for category ${categoryUrl}, attempt ${attempt + 1}`);
            await page.close();
            if (attempt < this.config.maxRetries) {
              await this.sleep(2000 * (attempt + 1));
              continue;
            }
            throw new Error('CAPTCHA detected and max retries exceeded');
          }

          const asins = await this.extractCategoryASINs(page, maxProducts);
          await page.close();

          this.stats.successfulScrapes++;
          this.updateStats(Date.now() - startTime);

          return {
            success: true,
            data: {
              asins,
              marketplace,
              categoryUrl,
              totalProducts: asins.length,
            },
            retryCount: attempt,
            duration: Date.now() - startTime,
          };
        } catch (error) {
          logger.error(`Error scraping category ${categoryUrl} (attempt ${attempt + 1}): ${error instanceof Error ? error.message : 'Unknown error'}`);

          if (attempt === this.config.maxRetries) {
            this.stats.failedScrapes++;
            this.updateStats(Date.now() - startTime);
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
              retryCount: attempt,
              duration: Date.now() - startTime,
            };
          }

          await this.sleep(1000 * (attempt + 1));
        }
      }

      return {
        success: false,
        error: 'Max retries exceeded',
        retryCount: this.config.maxRetries,
        duration: Date.now() - startTime,
      };
    });
  }

  private async extractProductData(page: Page, asin: string, marketplace: MarketplaceCode): Promise<ProductScrapeData> {
    const title = await page.$eval('#productTitle', (el) => el.textContent?.trim() || 'Unknown Title').catch(() => 'Unknown Title');

    const priceText = await page.$eval('.a-price .a-offscreen', (el) => el.textContent || '').catch(() => '');
    const price = this.parsePrice(priceText);

    const availabilityText = await page.$eval('#availability span', (el) => el.textContent || '').catch(() => '');
    const availability = !availabilityText.toLowerCase().includes('unavailable');

    const ratingText = await page.$eval('[data-hook="average-star-rating"] .a-icon-alt', (el) => el.textContent || '').catch(() => '');
    const rating = this.parseRating(ratingText);

    const reviewCountText = await page.$eval('[data-hook="total-review-count"] span', (el) => el.textContent || '').catch(() => '');
    const reviewCount = this.parseReviewCount(reviewCountText);

    const salesRank = await this.extractSalesRank(page);

    const seller = await page.$eval('#merchant-info', (el) => el.textContent?.trim() || 'Amazon').catch(() => 'Amazon');

    const isPrime = await page.$('#primeBadge') !== null;

    const imageUrl = await page.$eval('#landingImage', (el) => el.getAttribute('src') || '').catch(() => '');

    return {
      asin,
      marketplace,
      title,
      price,
      currency: 'EUR',
      availability,
      rating,
      reviewCount,
      salesRank,
      seller,
      isPrime,
      imageUrl: imageUrl || undefined,
      productUrl: this.buildProductUrl(asin, marketplace),
      timestamp: new Date(),
    };
  }

  private async extractCategoryASINs(page: Page, maxProducts: number): Promise<string[]> {
    const asins: string[] = [];

    // Try multiple selectors for product links
    const selectors = [
      'div[data-component-type="s-search-result"] h2 a',
      'div[data-asin] h2 a',
      '.s-result-item h2 a',
    ];

    for (const selector of selectors) {
      const links = await page.$$(selector);
      if (links.length > 0) {
        for (const link of links) {
          if (asins.length >= maxProducts) break;

          const href = await link.getAttribute('href');
          if (href) {
            const asinMatch = href.match(/\/([A-Z0-9]{10})(?:\/|$|\?)/);
            if (asinMatch) {
              asins.push(asinMatch[1]);
            }
          }
        }
        break;
      }
    }

    return asins;
  }

  private async extractSalesRank(page: Page): Promise<number> {
    try {
      const rankText = await page.$eval('#productDetails_detailBullets_sections1 td', (el) => el.textContent || '').catch(() => '');
      const match = rankText.match(/#([\d,]+)/);
      if (match) {
        return parseInt(match[1].replace(/,/g, ''), 10);
      }
    } catch {
      // Ignore errors
    }
    return 0;
  }

  private parsePrice(priceText: string): Decimal {
    const match = priceText.match(/[\d.,]+/);
    if (match) {
      const cleaned = match[0].replace(/,/g, '.').replace(/[^\d.]/g, '');
      return new Decimal(cleaned);
    }
    return new Decimal(0);
  }

  private parseRating(ratingText: string): number {
    const match = ratingText.match(/([\d.]+)/);
    if (match) {
      return parseFloat(match[1]);
    }
    return 0;
  }

  private parseReviewCount(reviewCountText: string): number {
    const match = reviewCountText.match(/[\d,]+/);
    if (match) {
      return parseInt(match[0].replace(/,/g, ''), 10);
    }
    return 0;
  }

  private buildProductUrl(asin: string, marketplace: MarketplaceCode): string {
    const domains: Record<MarketplaceCode, string> = {
      DE: 'amazon.de',
      FR: 'amazon.fr',
      IT: 'amazon.it',
      ES: 'amazon.es',
    };
    return `https://www.${domains[marketplace]}/dp/${asin}`;
  }

  private updateStats(duration: number): void {
    this.stats.lastScrapeTime = new Date();
    const totalDuration = this.stats.averageDuration * (this.stats.successfulScrapes - 1) + duration;
    this.stats.averageDuration = totalDuration / this.stats.successfulScrapes;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getStats(): ScrapingStats {
    return { ...this.stats };
  }

  async close(): Promise<void> {
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
    logger.info('Amazon scraper closed');
  }
}
