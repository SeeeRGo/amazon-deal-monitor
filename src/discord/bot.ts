import { Client, GatewayIntentBits, TextChannel, REST, Routes, ChatInputCommandInteraction } from 'discord.js';
import { DiscordConfig, DealNotificationOptions } from './types.js';
import { DealEmbedBuilder } from './embed-builder.js';
import { CommandHandler } from './command-handler.js';
import { logger } from '../utils/logger.js';
import { Deal, DealTier } from '../models/deal.js';
import { DealTierConfig } from '../models/deal.js';

export class DiscordBot {
  private client: Client;
  private commandHandler: CommandHandler;
  private dealsChannel: TextChannel | null = null;
  private tierConfigs: Record<DealTier, DealTierConfig>;

  constructor(
    private config: DiscordConfig,
    tierConfigs: Record<DealTier, DealTierConfig>
  ) {
    this.tierConfigs = tierConfigs;
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

    this.commandHandler = new CommandHandler(config.commandPrefix);

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.once('ready', async () => {
      logger.info(`Discord bot logged in as ${this.client.user?.tag}`);
      await this.initializeDealsChannel();
      // Register slash commands after bot is ready
      await this.registerCommands();
    });

    this.client.on('interactionCreate', async (interaction) => {
      if (!interaction.isChatInputCommand()) return;

      const context = {
        userId: interaction.user.id,
        username: interaction.user.username,
        channelId: interaction.channelId,
        guildId: interaction.guildId || '',
      };

      const result = await this.commandHandler.handleCommand(interaction, context);

      if (result.success) {
        if (interaction.commandName === 'my-settings') {
          const settings = this.commandHandler.getUserSettings(context.userId);
          const embed = DealEmbedBuilder.buildSettingsEmbed(settings);
          await interaction.reply({ embeds: [embed] });
        } else if (interaction.commandName === 'help') {
          const embed = DealEmbedBuilder.buildHelpEmbed(this.config.commandPrefix);
          await interaction.reply({ embeds: [embed] });
        } else {
          await interaction.reply({ content: result.message, ephemeral: true });
        }
      } else {
        const embed = DealEmbedBuilder.buildErrorEmbed('Error', result.message);
        await interaction.reply({ embeds: [embed], ephemeral: true });
      }
    });

    this.client.on('error', (error) => {
      logger.error(`Discord bot error: ${error.message}`);
    });
  }

  private async initializeDealsChannel(): Promise<void> {
    try {
      const channel = await this.client.channels.fetch(this.config.dealsChannelId);
      if (channel && channel instanceof TextChannel) {
        this.dealsChannel = channel;
        logger.info(`Deals channel initialized: ${channel.name}`);
      } else {
        logger.error(`Failed to initialize deals channel: Invalid channel type`);
      }
    } catch (error) {
      logger.error(`Failed to fetch deals channel: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async start(): Promise<void> {
    try {
      logger.info('Starting Discord bot...');

      // Login to Discord
      await this.client.login(this.config.botToken);

      logger.info('Discord bot started successfully');
    } catch (error) {
      logger.error(`Failed to start Discord bot: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  async stop(): Promise<void> {
    logger.info('Stopping Discord bot...');
    await this.client.destroy();
    logger.info('Discord bot stopped');
  }

  private async registerCommands(): Promise<void> {
    try {
      const commands = this.commandHandler.getSlashCommands();

      const rest = new REST({ version: '10' }).setToken(this.config.botToken);

      logger.info(`Registering ${commands.length} slash commands...`);

      const clientId = this.client.user?.id;
      if (!clientId) {
        throw new Error('Client user ID not available');
      }

      await rest.put(
        Routes.applicationGuildCommands(clientId, this.config.guildId),
        { body: commands }
      );

      logger.info('Slash commands registered successfully');
    } catch (error) {
      logger.error(`Failed to register slash commands: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Don't throw error - allow bot to continue without slash commands
    }
  }

  async sendDealNotification(deal: Deal): Promise<void> {
    if (!this.dealsChannel) {
      logger.warn('Deals channel not initialized, skipping notification');
      return;
    }

    try {
      const tierConfig = this.tierConfigs[deal.tier];

      const options: DealNotificationOptions = {
        deal,
        tierConfig,
        enableRolePing: this.config.enableRolePings,
      };

      const embed = DealEmbedBuilder.buildDealEmbed(options);

      let content = '';
      if (this.config.enableRolePings) {
        content = `<@&${tierConfig.role}>`;
      }

      await this.dealsChannel.send({
        content: content || undefined,
        embeds: [embed],
      });

      logger.info(`Deal notification sent for ASIN ${deal.product.asin} (Tier: ${deal.tier})`);
    } catch (error) {
      logger.error(`Failed to send deal notification: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async sendBulkDealNotifications(deals: Deal[]): Promise<void> {
    if (!this.dealsChannel) {
      logger.warn('Deals channel not initialized, skipping notifications');
      return;
    }

    for (const deal of deals) {
      await this.sendDealNotification(deal);
      // Add a small delay between notifications to avoid rate limiting
      await this.sleep(1000);
    }
  }

  async sendDemoSummary(summary: {
    totalScraped: number;
    totalDeals: number;
    topDeals: Array<{ asin: string; title: string; margin: number; roi: number; profit: number }>;
    dealsByTier: Record<string, number>;
    dealsByMarketplace: Record<string, number>;
    highMarginCount: number;
    highRoiCount: number;
    profitableCount: number;
  }): Promise<void> {
    if (!this.dealsChannel) {
      logger.warn('Deals channel not initialized, skipping summary');
      return;
    }

    try {
      const embed = DealEmbedBuilder.buildDemoSummaryEmbed(summary);

      await this.dealsChannel.send({
        content: '📊 **Demo Summary Report**',
        embeds: [embed],
      });

      logger.info('Demo summary sent to Discord');
    } catch (error) {
      logger.error(`Failed to send demo summary: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  getCommandHandler(): CommandHandler {
    return this.commandHandler;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  isReady(): boolean {
    return this.client.isReady();
  }
}
