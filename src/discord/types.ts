import { Deal } from '../models/deal.js';
import { DealTier } from '../models/deal.js';

export interface DiscordConfig {
  botToken: string;
  guildId: string;
  dealsChannelId: string;
  commandPrefix: string;
  enableRolePings: boolean;
  maxEmbedFields: number;
  rateLimitPerMinute: number;
}

export interface DealNotificationOptions {
  deal: Deal;
  tierConfig: {
    role: string;
    color: number;
  };
  enableRolePing: boolean;
}

export interface CommandContext {
  userId: string;
  username: string;
  channelId: string;
  guildId: string;
}

export interface CommandResult {
  success: boolean;
  message: string;
  error?: string;
}

export interface UserSettings {
  userId: string;
  minMargin: number;
  minRoi: number;
  minProfit: number;
  enabledMarketplaces: string[];
  enabledDealTiers: DealTier[];
  enableNotifications: boolean;
}
