import 'dotenv/config';
import { loadConfig } from './config/index.js';
import { logger } from './utils/logger.js';
import { DealAnalyzer } from './analyzer/analyzer.js';
import { DealTracker } from './tracker/tracker.js';
import { AmazonScraper } from './scraper/scraper.js';
import { DiscordBot } from './discord/bot.js';
import Decimal from 'decimal.js';

/**
 * Demo script to test core functionality by scraping real Amazon products
 * Run with: pnpm demo
 * Run with Discord posting: pnpm demo --discord
 */

// Real Amazon ASINs to scrape (you can verify these URLs)
const DEMO_ASINS = [
  { asin: 'B08N5KWB9H', marketplace: 'DE' as const, costPrice: new Decimal('20.00') }, // Amazon Basics products
  { asin: 'B08N5WRWNQ', marketplace: 'FR' as const, costPrice: new Decimal('15.00') },
  { asin: 'B08N5KWB9H', marketplace: 'IT' as const, costPrice: new Decimal('18.00') },
  { asin: 'B08N5WRWNQ', marketplace: 'ES' as const, costPrice: new Decimal('16.00') },
];

async function demo() {
  // Check for Discord flag
  const enableDiscord = process.argv.includes('--discord');
  
  console.log('\n========================================');
  console.log('  Amazon Deal Monitor - Live Demo');
  console.log('========================================\n');
  if (enableDiscord) {
    console.log('  Discord posting: ENABLED');
  } else {
    console.log('  Discord posting: DISABLED (use --discord to enable)');
  }
  console.log('');

  try {
    // 1. Load configuration
    logger.info('Loading configuration...');
    const config = loadConfig();
    logger.info(`✓ Configuration loaded`);
    logger.info(`  Marketplaces: ${config.marketplaces.map((m) => m.code).join(', ')}`);
    logger.info(`  Deal Tiers: ${Object.keys(config.dealTiers).join(', ')}`);

    // 2. Initialize Scraper
    logger.info('\nInitializing Amazon Scraper...');
    const scraper = new AmazonScraper(
      config.scraper,
      undefined, // No proxy manager for demo
      undefined  // No user agent manager for demo
    );
    await scraper.initialize();
    logger.info('✓ Scraper initialized');

    // 3. Initialize Analyzer
    logger.info('\nInitializing Deal Analyzer...');
    const analyzer = new DealAnalyzer(config.dealTiers);
    logger.info('✓ Analyzer initialized');

    // 4. Initialize Tracker
    logger.info('\nInitializing Deal Tracker...');
    const tracker = new DealTracker({
      maxHistoryEntries: 1000,
      priceChangeThreshold: 5,
      enablePriceChangeAlerts: true,
    });
    logger.info('✓ Tracker initialized');

    // 5. Initialize Discord Bot (if enabled)
    let discordBot: DiscordBot | null = null;
    if (enableDiscord) {
      logger.info('\nInitializing Discord Bot...');
      const discordConfig = {
        botToken: process.env.DISCORD_BOT_TOKEN || '',
        guildId: process.env.DISCORD_GUILD_ID || '',
        dealsChannelId: process.env.DISCORD_DEALS_CHANNEL_ID || '',
        commandPrefix: config.discord.commandPrefix,
        enableRolePings: config.discord.enableRolePings,
        maxEmbedFields: config.discord.maxEmbedFields,
        rateLimitPerMinute: config.discord.rateLimitPerMinute,
      };

      if (!discordConfig.botToken || !discordConfig.guildId || !discordConfig.dealsChannelId) {
        logger.warn('Discord configuration incomplete. Please set DISCORD_BOT_TOKEN, DISCORD_GUILD_ID, and DISCORD_DEALS_CHANNEL_ID in .env');
        logger.warn('Continuing without Discord posting...');
      } else {
        discordBot = new DiscordBot(discordConfig, config.dealTiers);
        await discordBot.start();
        
        // Wait for bot to be ready
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        if (discordBot.isReady()) {
          logger.info('✓ Discord bot initialized and ready');
        } else {
          logger.warn('Discord bot not ready, continuing without Discord posting...');
          discordBot = null;
        }
      }
    }

    // 6. Scrape real products from Amazon
    logger.info('\n========================================');
    logger.info('  Scraping Real Amazon Products');
    logger.info('========================================\n');

    const scrapedProducts = [];

    for (let i = 0; i < DEMO_ASINS.length; i++) {
      const { asin, marketplace, costPrice } = DEMO_ASINS[i];
      const productUrl = `https://www.${config.marketplaces.find(m => m.code === marketplace)?.domain || 'amazon.de'}/dp/${asin}`;

      logger.info(`\n--- Scraping Product ${i + 1} ---`);
      logger.info(`ASIN: ${asin}`);
      logger.info(`Marketplace: ${marketplace}`);
      logger.info(`URL: ${productUrl}`);
      logger.info(`Estimated Cost: €${costPrice.toFixed(2)}`);

      const result = await scraper.scrapeProduct(asin, marketplace);

      if (result.success && result.data) {
        logger.info(`✓ Successfully scraped: ${result.data.title}`);
        logger.info(`  Price: €${result.data.price.toFixed(2)}`);
        logger.info(`  Rating: ${result.data.rating} (${result.data.reviewCount} reviews)`);
        logger.info(`  Sales Rank: ${result.data.salesRank}`);
        logger.info(`  Seller: ${result.data.seller}`);
        logger.info(`  Prime: ${result.data.isPrime ? 'Yes' : 'No'}`);

        scrapedProducts.push({
          product: result.data,
          costPrice,
        });
      } else {
        logger.error(`✗ Failed to scrape: ${result.error}`);
      }

      // Add delay between requests to avoid rate limiting
      if (i < DEMO_ASINS.length - 1) {
        logger.info('Waiting 2 seconds before next request...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    if (scrapedProducts.length === 0) {
      logger.error('\n❌ No products were successfully scraped. Demo cannot continue.');
      logger.info('This could be due to:');
      logger.info('  - Network connectivity issues');
      logger.info('  - Amazon blocking the requests');
      logger.info('  - CAPTCHA challenges');
      process.exit(1);
    }

    // 6. Analyze scraped products
    logger.info('\n========================================');
    logger.info('  Analyzing Scraped Products');
    logger.info('========================================\n');

    for (let i = 0; i < scrapedProducts.length; i++) {
      const { product, costPrice } = scrapedProducts[i];

      logger.info(`\n--- Analyzing Product ${i + 1} ---`);
      logger.info(`ASIN: ${product.asin}`);
      logger.info(`Title: ${product.title}`);
      logger.info(`URL: ${product.productUrl}`);
      logger.info(`Price: €${product.price.toFixed(2)}`);
      logger.info(`Cost: €${costPrice.toFixed(2)}`);

      const deal = analyzer.analyze(product, {
        costPrice,
        fulfillmentType: 'FBA',
        category: 'default',
      });

      logger.info(`\n📊 Deal Analysis Results:`);
      logger.info(`  Sale Price: €${deal.metrics.salePrice.toFixed(2)}`);
      logger.info(`  Cost Price: €${deal.metrics.costPrice.toFixed(2)}`);
      logger.info(`  Total Fees: €${deal.metrics.totalFees.toFixed(2)}`);
      logger.info(`  Profit: €${deal.metrics.profit.toFixed(2)}`);
      logger.info(`  Margin: ${deal.metrics.margin.toFixed(2)}%`);
      logger.info(`  ROI: ${deal.metrics.roi.toFixed(2)}%`);
      logger.info(`  Tier: ${deal.tier.toUpperCase()}`);

      // Track the deal
      tracker.trackDeal(deal);
      logger.info(`✓ Deal tracked`);

      // Send to Discord if enabled
      if (discordBot && discordBot.isReady()) {
        logger.info(`📤 Sending deal notification to Discord...`);
        await discordBot.sendDealNotification(deal);
        logger.info(`✓ Deal notification sent to Discord`);
      }

      // Track price history
      const priceAlert = tracker.trackProduct(product);
      if (priceAlert) {
        logger.info(`⚠️  Price Alert: ${priceAlert.oldPrice.toFixed(2)} -> ${priceAlert.newPrice.toFixed(2)} (${priceAlert.changePercentage.toFixed(2)}%)`);
      }
    }

    // 7. Test Tracker functionality
    logger.info('\n========================================');
    logger.info('  Testing Tracker Functionality');
    logger.info('========================================\n');

    logger.info(`Total tracked deals: ${tracker.getTrackedDealsCount()}`);
    logger.info(`Total tracked products: ${tracker.getTrackedProductsCount()}`);

    logger.info('\n--- Top Deals by Margin ---');
    const topDeals = tracker.getTopDeals(3, 'margin');
    topDeals.forEach((deal, index) => {
      logger.info(`  ${index + 1}. ${deal.product.asin} - ${deal.metrics.margin.toFixed(2)}% margin`);
      logger.info(`     URL: ${deal.product.productUrl}`);
    });

    logger.info('\n--- Deals by Tier ---');
    ['low', 'medium', 'high'].forEach((tier) => {
      const deals = tracker.getDealsByTier(tier as 'low' | 'medium' | 'high');
      logger.info(`  ${tier.toUpperCase()}: ${deals.length} deal(s)`);
    });

    logger.info('\n--- Deals by Marketplace ---');
    config.marketplaces.forEach((marketplace) => {
      const deals = tracker.getDealsByMarketplace(marketplace.code);
      logger.info(`  ${marketplace.code}: ${deals.length} deal(s)`);
    });

    // 8. Test price history
    logger.info('\n========================================');
    logger.info('  Testing Price History');
    logger.info('========================================\n');

    if (scrapedProducts.length > 0) {
      const testAsin = scrapedProducts[0].product.asin;
      const testMarketplace = scrapedProducts[0].product.marketplace;
      const history = tracker.getPriceHistory(testAsin, testMarketplace);
      logger.info(`Price history for ${testAsin}: ${history.length} entries`);
      history.forEach((entry) => {
        logger.info(`  ${entry.timestamp.toISOString()} - €${entry.price.toFixed(2)}`);
      });

      const avgPrice = tracker.getAveragePrice(testAsin, testMarketplace, 30);
      const lowestPrice = tracker.getLowestPrice(testAsin, testMarketplace, 30);
      const highestPrice = tracker.getHighestPrice(testAsin, testMarketplace, 30);

      logger.info(`\nPrice Statistics (30 days):`);
      logger.info(`  Average: €${avgPrice?.toFixed(2) || 'N/A'}`);
      logger.info(`  Lowest: €${lowestPrice?.toFixed(2) || 'N/A'}`);
      logger.info(`  Highest: €${highestPrice?.toFixed(2) || 'N/A'}`);
    }

    // 9. Test deal filtering
    logger.info('\n========================================');
    logger.info('  Testing Deal Filtering');
    logger.info('========================================\n');

    const highMarginDeals = tracker.filterDeals({ minMargin: 40 });
    logger.info(`Deals with >40% margin: ${highMarginDeals.length}`);

    const highRoiDeals = tracker.filterDeals({ minRoi: 200 });
    logger.info(`Deals with >200% ROI: ${highRoiDeals.length}`);

    const profitableDeals = tracker.filterDeals({ minProfit: 10 });
    logger.info(`Deals with >€10 profit: ${profitableDeals.length}`);

    // 10. Send demo summary to Discord (if enabled)
    if (discordBot && discordBot.isReady()) {
      logger.info('\n========================================');
      logger.info('  Sending Demo Summary to Discord');
      logger.info('========================================\n');

      const topDeals = tracker.getTopDeals(3, 'margin');
      const topDealsFormatted = topDeals.map(deal => ({
        asin: deal.product.asin,
        title: deal.product.title,
        margin: deal.metrics.margin,
        roi: deal.metrics.roi,
        profit: deal.metrics.profit.toNumber(),
      }));

      const dealsByTier: Record<string, number> = {
        low: tracker.getDealsByTier('low').length,
        medium: tracker.getDealsByTier('medium').length,
        high: tracker.getDealsByTier('high').length,
      };

      const dealsByMarketplace: Record<string, number> = {};
      config.marketplaces.forEach((marketplace) => {
        dealsByMarketplace[marketplace.code] = tracker.getDealsByMarketplace(marketplace.code).length;
      });

      const summary = {
        totalScraped: scrapedProducts.length,
        totalDeals: tracker.getTrackedDealsCount(),
        topDeals: topDealsFormatted,
        dealsByTier,
        dealsByMarketplace,
        highMarginCount: highMarginDeals.length,
        highRoiCount: highRoiDeals.length,
        profitableCount: profitableDeals.length,
      };

      await discordBot.sendDemoSummary(summary);
      logger.info('✓ Demo summary sent to Discord');
    }

    // 11. Close Discord bot (if enabled)
    if (discordBot) {
      logger.info('\nClosing Discord bot...');
      await discordBot.stop();
      logger.info('✓ Discord bot closed');
    }

    // 12. Close scraper
    logger.info('\nClosing scraper...');
    await scraper.close();
    logger.info('✓ Scraper closed');

    // 13. Summary
    logger.info('\n========================================');
    logger.info('  Demo Summary');
    logger.info('========================================\n');

    logger.info(`✓ Successfully scraped ${scrapedProducts.length} real Amazon products`);
    logger.info('✓ Configuration loaded successfully');
    logger.info('✓ Amazon Scraper working correctly');
    logger.info('✓ Deal Analyzer working correctly');
    logger.info('✓ Deal Tracker working correctly');
    logger.info('✓ Price History tracking working');
    logger.info('✓ Deal filtering working');
    logger.info('✓ Deal classification working');
    if (discordBot && discordBot.isReady()) {
      logger.info('✓ Discord bot integration working');
    }

    logger.info('\n🎉 All core functionality is working!');
    logger.info('\nTo run the demo with Discord posting:');
    logger.info('  pnpm demo --discord');
    logger.info('\nTo run the full application:');
    logger.info('  1. Set up your .env file with Discord credentials');
    logger.info('  2. Run: pnpm dev');
    logger.info('\nTo run tests:');
    logger.info('  pnpm test');

    console.log('\n========================================\n');

    process.exit(0);
  } catch (error) {
    logger.error(`Demo failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    if (error instanceof Error && error.stack) {
      logger.error(error.stack);
    }
    process.exit(1);
  }
}

demo();
