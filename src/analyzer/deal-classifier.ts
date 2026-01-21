import Decimal from 'decimal.js';
import { Deal, DealTier, DealTierConfig } from '../models/deal.js';

export interface ClassificationResult {
  tier: DealTier;
  qualifies: boolean;
  reasons: string[];
}

export class DealClassifier {
  constructor(private tierConfigs: Record<DealTier, DealTierConfig>) {}

  classify(deal: Deal): ClassificationResult {
    const { margin, roi } = deal.metrics;

    // Check high tier first
    if (this.checkTier(deal, 'high')) {
      return {
        tier: 'high',
        qualifies: true,
        reasons: this.getTierReasons('high', margin, roi),
      };
    }

    // Check medium tier
    if (this.checkTier(deal, 'medium')) {
      return {
        tier: 'medium',
        qualifies: true,
        reasons: this.getTierReasons('medium', margin, roi),
      };
    }

    // Check low tier
    if (this.checkTier(deal, 'low')) {
      return {
        tier: 'low',
        qualifies: true,
        reasons: this.getTierReasons('low', margin, roi),
      };
    }

    // Deal doesn't qualify for any tier
    return {
      tier: 'low',
      qualifies: false,
      reasons: this.getDisqualificationReasons(margin, roi),
    };
  }

  private checkTier(deal: Deal, tier: DealTier): boolean {
    const config = this.tierConfigs[tier];
    const { margin, roi } = deal.metrics;

    // Check minimum margin
    if (margin < config.minMargin) {
      return false;
    }

    // Check maximum margin (if specified)
    if (config.maxMargin !== undefined && margin > config.maxMargin) {
      return false;
    }

    // Check minimum ROI
    if (roi < config.minRoi) {
      return false;
    }

    // Check maximum ROI (if specified)
    if (config.maxRoi !== undefined && roi > config.maxRoi) {
      return false;
    }

    return true;
  }

  private getTierReasons(tier: DealTier, margin: number, roi: number): string[] {
    const config = this.tierConfigs[tier];
    const reasons: string[] = [];

    if (margin >= config.minMargin) {
      reasons.push(`Margin ${margin.toFixed(2)}% meets minimum ${config.minMargin}%`);
    }

    if (roi >= config.minRoi) {
      reasons.push(`ROI ${roi.toFixed(2)}% meets minimum ${config.minRoi}%`);
    }

    return reasons;
  }

  private getDisqualificationReasons(margin: number, roi: number): string[] {
    const reasons: string[] = [];

    // Check against lowest tier requirements
    const lowestTier = this.tierConfigs.low;

    if (margin < lowestTier.minMargin) {
      reasons.push(`Margin ${margin.toFixed(2)}% below minimum ${lowestTier.minMargin}%`);
    }

    if (roi < lowestTier.minRoi) {
      reasons.push(`ROI ${roi.toFixed(2)}% below minimum ${lowestTier.minRoi}%`);
    }

    return reasons;
  }

  getTierConfig(tier: DealTier): DealTierConfig {
    return this.tierConfigs[tier];
  }

  getAllTierConfigs(): Record<DealTier, DealTierConfig> {
    return { ...this.tierConfigs };
  }

  updateTierConfig(tier: DealTier, config: Partial<DealTierConfig>): void {
    this.tierConfigs[tier] = { ...this.tierConfigs[tier], ...config };
  }
}
