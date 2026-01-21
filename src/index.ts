import 'dotenv/config';
import { loadConfig } from './config/index.js';
import { logger } from './utils/logger.js';
import { AmazonScraper } from './scraper/scraper.js';
import { ProxyManager } from './scraper/proxy-manager.js';
import { UserAgentManager } from './scraper/user-agent-manager.js';
import { DealAnalyzer } from './analyzer/analyzer.js';
import { DiscordBot } from './discord/bot.js';
import { DealScheduler } from './scheduler/scheduler.js';
import { DealTracker } from './tracker/tracker.js';
import { AmazonFeeApiClient } from './api/amazon-fee-api.js';

// Global instances
let scraper: AmazonScraper | null = null;
let analyzer: DealAnalyzer | null = null;
let discordBot: DiscordBot | null = null;
let scheduler: DealScheduler | null = null;
let tracker: DealTracker | null = null;
let feeApiClient: AmazonFeeApiClient | null = null;

async function main() {
  try {
    logger.info('Starting Amazon Deal Monitoring System...');

    // Load configuration
    const config = loadConfig();
    logger.info('Configuration loaded successfully');
    logger.info(`Monitoring marketplaces: ${config.marketplaces.map((m) => m.code).join(', ')}`);
    logger.info(`Deal tiers configured: ${Object.keys(config.dealTiers).join(', ')}`);

    // Initialize components

    // 1. Initialize Proxy Manager (if enabled)
    let proxyManager: ProxyManager | undefined;
    if (config.scraper.useProxies) {
      const proxiesPath = process.env.SCRAPER_PROXIES_FILE || 'config/proxies.txt';
      proxyManager = new ProxyManager(proxiesPath);
      logger.info('Proxy manager initialized');
    }

    // 2. Initialize User Agent Manager (if enabled)
    let userAgentManager: UserAgentManager | undefined;
    if (config.scraper.rotateUserAgents) {
      const userAgentsPath = process.env.SCRAPER_USER_AGENTS_FILE || 'config/user_agents.json';
      userAgentManager = new UserAgentManager(userAgentsPath);
      logger.info('User agent manager initialized');
    }

    // 3. Initialize Scraper
    scraper = new AmazonScraper(
      config.scraper,
      proxyManager,
      userAgentManager
    );
    await scraper.initialize();
    logger.info('Scraper initialized');

    // 4. Initialize Analyzer
    analyzer = new DealAnalyzer(config.dealTiers);
    logger.info('Analyzer initialized');

    // 5. Initialize Discord Bot
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
      logger.warn('Discord configuration incomplete, bot will not start');
    } else {
      discordBot = new DiscordBot(discordConfig, config.dealTiers);
      await discordBot.start();
      logger.info('Discord bot initialized');
    }

    // 6. Initialize Fee API Client (if configured)
    if (process.env.AMAZON_FEE_API_KEY && process.env.AMAZON_FEE_API_URL) {
      feeApiClient = new AmazonFeeApiClient({
        apiKey: process.env.AMAZON_FEE_API_KEY,
        apiUrl: process.env.AMAZON_FEE_API_URL,
        timeout: 10000,
      });
      logger.info('Fee API client initialized');
    } else {
      logger.warn('Fee API not configured, using default fee calculations');
    }

    // 7. Initialize Tracker
    tracker = new DealTracker({
      maxHistoryEntries: 1000,
      priceChangeThreshold: 5,
      enablePriceChangeAlerts: true,
    });
    logger.info('Tracker initialized');

    // 8. Initialize Scheduler
    if (scraper && analyzer && discordBot) {
      scheduler = new DealScheduler(
        config.scheduler,
        scraper,
        analyzer,
        discordBot
      );
      scheduler.start();
      logger.info('Scheduler started');
    }

    logger.info('Amazon Deal Monitoring System started successfully');

    // Keep the process running
    process.on('SIGINT', gracefulShutdown);
    process.on('SIGTERM', gracefulShutdown);

  } catch (error) {
    if (error instanceof Error) {
      logger.error(`Failed to start application: ${error.message}`);
    } else {
      logger.error('Failed to start application: Unknown error');
    }
    process.exit(1);
  }
}

async function gracefulShutdown() {
  logger.info('Shutting down gracefully...');

  try {
    // Stop scheduler
    if (scheduler) {
      scheduler.stop();
      logger.info('Scheduler stopped');
    }

    // Close scraper
    if (scraper) {
      await scraper.close();
      logger.info('Scraper closed');
    }

    // Stop Discord bot
    if (discordBot) {
      await discordBot.stop();
      logger.info('Discord bot stopped');
    }

    logger.info('Shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error(`Error during shutdown: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}

main();
