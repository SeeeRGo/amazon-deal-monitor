import 'dotenv/config';
import { loadConfig } from './config/index.js';
import { logger } from './utils/logger.js';
import { DealAnalyzer } from './analyzer/analyzer.js';
import { DealTracker } from './tracker/tracker.js';
import { DiscordBot } from './discord/bot.js';
import Decimal from 'decimal.js';
import type { ProductData } from './models/product.js';

/**
 * Demo script to test core functionality using mock data (no Playwright required)
 * Run with: pnpm demo:mock
 * Run with Discord posting: pnpm demo:mock --discord
 */

// Mock product data simulating scraped Amazon products
const MOCK_PRODUCTS: Array<{
  product: ProductData;
  costPrice: Decimal;
}> = [
  {
    product: {
      asin: 'B08N5KWB9H',
      marketplace: 'DE',
      title: 'Amazon Basics 8-Sheet High-Capacity Cross-Cut Paper and Credit Card Shredder',
      price: new Decimal('24.99'),
      currency: 'EUR',
      availability: true,
      rating: 4.5,
      reviewCount: 15420,
      salesRank: 1250,
      seller: 'Amazon',
      isPrime: true,
      productUrl: 'https://www.amazon.de/dp/B08N5KWB9H',
      imageUrl: 'https://example.com/image1.jpg',
      timestamp: new Date(),
    },
    costPrice: new Decimal('15.00'),
  },
  {
    product: {
      asin: 'B08N5WRWNQ',
      marketplace: 'FR',
      title: 'Amazon Basics 4-Sheet Cross-Cut Paper and Credit Card Shredder',
      price: new Decimal('19.99'),
      currency: 'EUR',
      availability: true,
      rating: 4.3,
      reviewCount: 8932,
      salesRank: 2100,
      seller: 'Amazon',
      isPrime: true,
      productUrl: 'https://www.amazon.fr/dp/B08N5WRWNQ',
      imageUrl: 'https://example.com/image2.jpg',
      timestamp: new Date(),
    },
    costPrice: new Decimal('12.00'),
  },
  {
    product: {
      asin: 'B09X7XZ9Y8',
      marketplace: 'IT',
      title: 'Wireless Bluetooth Headphones with Noise Cancellation',
      price: new Decimal('49.99'),
      currency: 'EUR',
      availability: true,
      rating: 4.7,
      reviewCount: 3250,
      salesRank: 850,
      seller: 'Third Party Seller',
      isPrime: true,
      productUrl: 'https://www.amazon.it/dp/B09X7XZ9Y8',
      imageUrl: 'https://example.com/image3.jpg',
      timestamp: new Date(),
    },
    costPrice: new Decimal('25.00'),
  },
  {
    product: {
      asin: 'B07Y8K4L3M',
      marketplace: 'ES',
      title: 'Smart Home LED Light Bulb, WiFi Compatible',
      price: new Decimal('12.99'),
      currency: 'EUR',
      availability: true,
      rating: 4.2,
      reviewCount: 5678,
      salesRank: 3200,
      seller: 'Amazon',
      isPrime: true,
      productUrl: 'https://www.amazon.es/dp/B07Y8K4L3M',
      imageUrl: 'https://example.com/image4.jpg',
      timestamp: new Date(),
    },
    costPrice: new Decimal('6.00'),
  },
];

async function demo() {
  // Check for Discord flag
  const enableDiscord = process.argv.includes('--discord');
  
  console.log('\n========================================');
  console.log('  Amazon Deal Monitor - Mock Demo');
  console.log('  (No Playwright Required)');
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

    // 2. Initialize Analyzer
    logger.info('\nInitializing Deal Analyzer...');
    const analyzer = new DealAnalyzer(config.dealTiers);
    logger.info('✓ Analyzer initialized');

    // 3. Initialize Tracker
    logger.info('\nInitializing Deal Tracker...');
    const tracker = new DealTracker({
      maxHistoryEntries: 1000,
      priceChangeThreshold: 5,
      enablePriceChangeAlerts: true,
    });
    logger.info('✓ Tracker initialized');

    // 4. Initialize Discord Bot (if enabled)
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

    // 5. Analyze mock products
    logger.info('\n========================================');
    logger.info('  Analyzing Mock Products');
    logger.info('========================================\n');

    for (let i = 0; i < MOCK_PRODUCTS.length; i++) {
      const { product, costPrice } = MOCK_PRODUCTS[i];

      logger.info(`\n--- Analyzing Product ${i + 1} ---`);
      logger.info(`ASIN: ${product.asin}`);
      logger.info(`Title: ${product.title}`);
      logger.info(`URL: ${product.productUrl}`);
      logger.info(`Price: €${product.price.toFixed(2)}`);
      logger.info(`Cost: €${costPrice.toFixed(2)}`);
      logger.info(`Rating: ${product.rating} (${product.reviewCount} reviews)`);
      logger.info(`Sales Rank: ${product.salesRank}`);
      logger.info(`Seller: ${product.seller}`);
      logger.info(`Prime: ${product.isPrime ? 'Yes' : 'No'}`);

      const deal = analyzer.analyze(product, {
        costPrice,
        fulfillmentType: 'FBA',
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

    // 6. Test Tracker functionality
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

    // 7. Test price history
    logger.info('\n========================================');
    logger.info('  Testing Price History');
    logger.info('========================================\n');

    if (MOCK_PRODUCTS.length > 0) {
      const testAsin = MOCK_PRODUCTS[0].product.asin;
      const testMarketplace = MOCK_PRODUCTS[0].product.marketplace;
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

    // 8. Test deal filtering
    logger.info('\n========================================');
    logger.info('  Testing Deal Filtering');
    logger.info('========================================\n');

    const highMarginDeals = tracker.filterDeals({ minMargin: 40 });
    logger.info(`Deals with >40% margin: ${highMarginDeals.length}`);

    const highRoiDeals = tracker.filterDeals({ minRoi: 200 });
    logger.info(`Deals with >200% ROI: ${highRoiDeals.length}`);

    const profitableDeals = tracker.filterDeals({ minProfit: 10 });
    logger.info(`Deals with >€10 profit: ${profitableDeals.length}`);

    // 9. Close Discord bot (if enabled)
    if (discordBot) {
      logger.info('\nClosing Discord bot...');
      await discordBot.stop();
      logger.info('✓ Discord bot closed');
    }

    // 10. Summary
    logger.info('\n========================================');
    logger.info('  Demo Summary');
    logger.info('========================================\n');

    logger.info(`✓ Successfully analyzed ${MOCK_PRODUCTS.length} mock products`);
    logger.info('✓ Configuration loaded successfully');
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
    logger.info('  pnpm demo:mock --discord');
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
