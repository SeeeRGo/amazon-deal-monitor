import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import Decimal from 'decimal.js';
import { CommandContext, CommandResult, UserSettings } from './types.js';
import { DealEmbedBuilder } from './embed-builder.js';
import { logger } from '../utils/logger.js';
import { MarketplaceCode } from '../models/product.js';
import { DealTier } from '../models/deal.js';

export interface Command {
  name: string;
  description: string;
  execute: (interaction: ChatInputCommandInteraction, context: CommandContext) => Promise<CommandResult>;
}

export class CommandHandler {
  private commands: Map<string, Command> = new Map();
  private userSettings: Map<string, UserSettings> = new Map();
  private watchlist: Map<string, Set<string>> = new Map(); // userId -> ASINs
  private categoryWatchlist: Map<string, Set<string>> = new Map(); // userId -> category URLs

  constructor(private prefix: string) {
    this.registerCommands();
  }

  private registerCommands(): void {
    this.commands.set('set-margin', {
      name: 'set-margin',
      description: 'Set your minimum margin threshold',
      execute: this.handleSetMargin.bind(this),
    });

    this.commands.set('set-roi', {
      name: 'set-roi',
      description: 'Set your minimum ROI threshold',
      execute: this.handleSetRoi.bind(this),
    });

    this.commands.set('add-asin', {
      name: 'add-asin',
      description: 'Add an ASIN to your watchlist',
      execute: this.handleAddAsin.bind(this),
    });

    this.commands.set('remove-asin', {
      name: 'remove-asin',
      description: 'Remove an ASIN from your watchlist',
      execute: this.handleRemoveAsin.bind(this),
    });

    this.commands.set('add-category', {
      name: 'add-category',
      description: 'Add a category URL to your watchlist',
      execute: this.handleAddCategory.bind(this),
    });

    this.commands.set('my-settings', {
      name: 'my-settings',
      description: 'View your current settings',
      execute: this.handleMySettings.bind(this),
    });

    this.commands.set('toggle-marketplace', {
      name: 'toggle-marketplace',
      description: 'Enable/disable a marketplace',
      execute: this.handleToggleMarketplace.bind(this),
    });

    this.commands.set('help', {
      name: 'help',
      description: 'Show all available commands',
      execute: this.handleHelp.bind(this),
    });
  }

  async handleCommand(interaction: ChatInputCommandInteraction, context: CommandContext): Promise<CommandResult> {
    const commandName = interaction.commandName;
    const command = this.commands.get(commandName);

    if (!command) {
      return {
        success: false,
        message: `Unknown command: ${commandName}`,
      };
    }

    try {
      return await command.execute(interaction, context);
    } catch (error) {
      logger.error(`Error executing command ${commandName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        success: false,
        message: 'An error occurred while executing the command',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async handleSetMargin(interaction: ChatInputCommandInteraction, context: CommandContext): Promise<CommandResult> {
    const margin = interaction.options.getNumber('percentage', true);

    if (margin < 0 || margin > 100) {
      return {
        success: false,
        message: 'Margin must be between 0 and 100',
      };
    }

    const settings = this.getUserSettings(context.userId);
    settings.minMargin = margin;
    this.userSettings.set(context.userId, settings);

    return {
      success: true,
      message: `Minimum margin set to ${margin}%`,
    };
  }

  private async handleSetRoi(interaction: ChatInputCommandInteraction, context: CommandContext): Promise<CommandResult> {
    const roi = interaction.options.getNumber('percentage', true);

    if (roi < 0) {
      return {
        success: false,
        message: 'ROI must be a positive number',
      };
    }

    const settings = this.getUserSettings(context.userId);
    settings.minRoi = roi;
    this.userSettings.set(context.userId, settings);

    return {
      success: true,
      message: `Minimum ROI set to ${roi}%`,
    };
  }

  private async handleAddAsin(interaction: ChatInputCommandInteraction, context: CommandContext): Promise<CommandResult> {
    const asin = interaction.options.getString('asin', true);

    // Validate ASIN format (10 alphanumeric characters)
    if (!/^[A-Z0-9]{10}$/i.test(asin)) {
      return {
        success: false,
        message: 'Invalid ASIN format. ASIN must be 10 alphanumeric characters.',
      };
    }

    if (!this.watchlist.has(context.userId)) {
      this.watchlist.set(context.userId, new Set());
    }

    this.watchlist.get(context.userId)!.add(asin.toUpperCase());

    return {
      success: true,
      message: `ASIN ${asin.toUpperCase()} added to your watchlist`,
    };
  }

  private async handleRemoveAsin(interaction: ChatInputCommandInteraction, context: CommandContext): Promise<CommandResult> {
    const asin = interaction.options.getString('asin', true);

    if (!this.watchlist.has(context.userId)) {
      return {
        success: false,
        message: 'Your watchlist is empty',
      };
    }

    const removed = this.watchlist.get(context.userId)!.delete(asin.toUpperCase());

    if (!removed) {
      return {
        success: false,
        message: `ASIN ${asin.toUpperCase()} not found in your watchlist`,
      };
    }

    return {
      success: true,
      message: `ASIN ${asin.toUpperCase()} removed from your watchlist`,
    };
  }

  private async handleAddCategory(interaction: ChatInputCommandInteraction, context: CommandContext): Promise<CommandResult> {
    const url = interaction.options.getString('url', true);

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return {
        success: false,
        message: 'Invalid URL format',
      };
    }

    if (!this.categoryWatchlist.has(context.userId)) {
      this.categoryWatchlist.set(context.userId, new Set());
    }

    this.categoryWatchlist.get(context.userId)!.add(url);

    return {
      success: true,
      message: 'Category URL added to your watchlist',
    };
  }

  private async handleMySettings(interaction: ChatInputCommandInteraction, context: CommandContext): Promise<CommandResult> {
    const settings = this.getUserSettings(context.userId);

    return {
      success: true,
      message: 'Settings retrieved',
    };
  }

  private async handleToggleMarketplace(interaction: ChatInputCommandInteraction, context: CommandContext): Promise<CommandResult> {
    const code = interaction.options.getString('code', true).toUpperCase() as MarketplaceCode;

    const validMarketplaces: MarketplaceCode[] = ['DE', 'FR', 'IT', 'ES'];
    if (!validMarketplaces.includes(code)) {
      return {
        success: false,
        message: `Invalid marketplace code. Valid options: ${validMarketplaces.join(', ')}`,
      };
    }

    const settings = this.getUserSettings(context.userId);
    const index = settings.enabledMarketplaces.indexOf(code);

    if (index > -1) {
      settings.enabledMarketplaces.splice(index, 1);
      this.userSettings.set(context.userId, settings);
      return {
        success: true,
        message: `Marketplace ${code} disabled`,
      };
    } else {
      settings.enabledMarketplaces.push(code);
      this.userSettings.set(context.userId, settings);
      return {
        success: true,
        message: `Marketplace ${code} enabled`,
      };
    }
  }

  private async handleHelp(interaction: ChatInputCommandInteraction, context: CommandContext): Promise<CommandResult> {
    return {
      success: true,
      message: 'Help command executed',
    };
  }

  public getUserSettings(userId: string): UserSettings {
    if (!this.userSettings.has(userId)) {
      this.userSettings.set(userId, {
        userId,
        minMargin: 25,
        minRoi: 100,
        minProfit: 10,
        enabledMarketplaces: ['DE', 'FR', 'IT', 'ES'],
        enabledDealTiers: ['low', 'medium', 'high'],
        enableNotifications: true,
      });
    }
    return this.userSettings.get(userId)!;
  }

  getUserWatchlist(userId: string): Set<string> {
    return this.watchlist.get(userId) || new Set();
  }

  getUserCategoryWatchlist(userId: string): Set<string> {
    return this.categoryWatchlist.get(userId) || new Set();
  }

  getAllUserSettings(): Map<string, UserSettings> {
    return new Map(this.userSettings);
  }

  getSlashCommands() {
    return [
      new SlashCommandBuilder()
        .setName('set-margin')
        .setDescription('Set your minimum margin threshold')
        .addNumberOption((option) =>
          option.setName('percentage').setDescription('Minimum margin percentage').setRequired(true)
        ),
      new SlashCommandBuilder()
        .setName('set-roi')
        .setDescription('Set your minimum ROI threshold')
        .addNumberOption((option) =>
          option.setName('percentage').setDescription('Minimum ROI percentage').setRequired(true)
        ),
      new SlashCommandBuilder()
        .setName('add-asin')
        .setDescription('Add an ASIN to your watchlist')
        .addStringOption((option) => option.setName('asin').setDescription('ASIN to add').setRequired(true)),
      new SlashCommandBuilder()
        .setName('remove-asin')
        .setDescription('Remove an ASIN from your watchlist')
        .addStringOption((option) => option.setName('asin').setDescription('ASIN to remove').setRequired(true)),
      new SlashCommandBuilder()
        .setName('add-category')
        .setDescription('Add a category URL to your watchlist')
        .addStringOption((option) => option.setName('url').setDescription('Category URL').setRequired(true)),
      new SlashCommandBuilder()
        .setName('my-settings')
        .setDescription('View your current settings'),
      new SlashCommandBuilder()
        .setName('toggle-marketplace')
        .setDescription('Enable/disable a marketplace')
        .addStringOption((option) =>
          option
            .setName('code')
            .setDescription('Marketplace code (DE, FR, IT, ES)')
            .setRequired(true)
            .addChoices(
              { name: 'Germany', value: 'DE' },
              { name: 'France', value: 'FR' },
              { name: 'Italy', value: 'IT' },
              { name: 'Spain', value: 'ES' }
            )
        ),
      new SlashCommandBuilder()
        .setName('help')
        .setDescription('Show all available commands'),
    ];
  }
}
