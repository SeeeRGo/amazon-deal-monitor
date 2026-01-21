import { EmbedBuilder, APIEmbedField } from 'discord.js';
import Decimal from 'decimal.js';
import { Deal, DealTier } from '../models/deal.js';
import { DealNotificationOptions } from './types.js';

export class DealEmbedBuilder {
  static buildDealEmbed(options: DealNotificationOptions): EmbedBuilder {
    const { deal, tierConfig, enableRolePing } = options;
    const { product, metrics, feeBreakdown, fulfillmentType } = deal;

    const embed = new EmbedBuilder()
      .setColor(tierConfig.color)
      .setTitle(product.title)
      .setURL(product.productUrl)
      .setThumbnail(product.imageUrl || null)
      .addFields(
        {
          name: '💰 Price',
          value: `${product.currency} ${product.price.toFixed(2)}`,
          inline: true,
        },
        {
          name: '📊 Margin',
          value: `${metrics.margin.toFixed(2)}%`,
          inline: true,
        },
        {
          name: '📈 ROI',
          value: `${metrics.roi.toFixed(2)}%`,
          inline: true,
        },
        {
          name: '💵 Profit',
          value: `${product.currency} ${metrics.profit.toFixed(2)}`,
          inline: true,
        },
        {
          name: '📦 ASIN',
          value: product.asin,
          inline: true,
        },
        {
          name: '🌍 Marketplace',
          value: product.marketplace,
          inline: true,
        },
        {
          name: '⭐ Rating',
          value: `${product.rating.toFixed(1)} (${product.reviewCount} reviews)`,
          inline: true,
        },
        {
          name: '🏷️ Sales Rank',
          value: product.salesRank > 0 ? `#${product.salesRank.toLocaleString()}` : 'N/A',
          inline: true,
        },
        {
          name: '🚚 Fulfillment',
          value: fulfillmentType,
          inline: true,
        },
        {
          name: '🏪 Seller',
          value: product.seller,
          inline: true,
        }
      )
      .setTimestamp(deal.detectedAt)
      .setFooter({ text: `Tier: ${deal.tier.toUpperCase()} | ${enableRolePing ? tierConfig.role : 'No ping'}` });

    // Add Prime badge if applicable
    if (product.isPrime) {
      embed.addFields({
        name: '✅ Prime',
        value: 'Eligible',
        inline: true,
      });
    }

    // Add fee breakdown
    embed.addFields({
      name: '💸 Fee Breakdown',
      value: this.formatFeeBreakdown(feeBreakdown, product.currency),
      inline: false,
    });

    return embed;
  }

  static buildErrorEmbed(title: string, message: string): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle(title)
      .setDescription(message)
      .setTimestamp();
  }

  static buildSuccessEmbed(title: string, message: string): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle(title)
      .setDescription(message)
      .setTimestamp();
  }

  static buildInfoEmbed(title: string, message: string): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle(title)
      .setDescription(message)
      .setTimestamp();
  }

  static buildSettingsEmbed(settings: any): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle('⚙️ Your Settings')
      .addFields(
        {
          name: '📊 Minimum Margin',
          value: `${settings.minMargin}%`,
          inline: true,
        },
        {
          name: '📈 Minimum ROI',
          value: `${settings.minRoi}%`,
          inline: true,
        },
        {
          name: '💵 Minimum Profit',
          value: `${settings.minProfit}`,
          inline: true,
        },
        {
          name: '🌍 Enabled Marketplaces',
          value: settings.enabledMarketplaces.join(', ') || 'None',
          inline: false,
        },
        {
          name: '🏷️ Enabled Deal Tiers',
          value: settings.enabledDealTiers.map((t: DealTier) => t.toUpperCase()).join(', ') || 'None',
          inline: false,
        },
        {
          name: '🔔 Notifications',
          value: settings.enableNotifications ? 'Enabled' : 'Disabled',
          inline: true,
        }
      )
      .setTimestamp();

    return embed;
  }

  static buildHelpEmbed(prefix: string): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle('🤖 Amazon Deal Monitor - Help')
      .setDescription('Available commands:')
      .addFields(
        {
          name: `${prefix}set-margin <percentage>`,
          value: 'Set your minimum margin threshold (e.g., 30)',
          inline: false,
        },
        {
          name: `${prefix}set-roi <percentage>`,
          value: 'Set your minimum ROI threshold (e.g., 150)',
          inline: false,
        },
        {
          name: `${prefix}add-asin <asin>`,
          value: 'Add an ASIN to your watchlist',
          inline: false,
        },
        {
          name: `${prefix}remove-asin <asin>`,
          value: 'Remove an ASIN from your watchlist',
          inline: false,
        },
        {
          name: `${prefix}add-category <url>`,
          value: 'Add a category URL to your watchlist',
          inline: false,
        },
        {
          name: `${prefix}my-settings`,
          value: 'View your current settings',
          inline: false,
        },
        {
          name: `${prefix}toggle-marketplace <code>`,
          value: 'Enable/disable a marketplace (DE, FR, IT, ES)',
          inline: false,
        },
        {
          name: `${prefix}help`,
          value: 'Show this help message',
          inline: false,
        }
      )
      .setTimestamp();
  }

  private static formatFeeBreakdown(feeBreakdown: any, currency: string): string {
    const parts = [
      `Referral: ${currency} ${feeBreakdown.referralFee.toFixed(2)}`,
      `Fulfillment: ${currency} ${feeBreakdown.fulfillmentFee.toFixed(2)}`,
      `Storage: ${currency} ${feeBreakdown.storageFee.toFixed(2)}`,
      `VAT: ${currency} ${feeBreakdown.vat.toFixed(2)}`,
      `Shipping: ${currency} ${feeBreakdown.shippingCost.toFixed(2)}`,
      `**Total: ${currency} ${feeBreakdown.total.toFixed(2)}**`,
    ];
    return parts.join('\n');
  }
}
