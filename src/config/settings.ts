import { z } from 'zod';

// Marketplace schema
export const MarketplaceSchema = z.object({
  code: z.enum(['DE', 'FR', 'IT', 'ES']),
  name: z.string(),
  domain: z.string(),
  currency: z.string(),
  vatRate: z.number(),
});

// Deal tier schema
export const DealTierSchema = z.object({
  minMargin: z.number(),
  maxMargin: z.number().optional(),
  minRoi: z.number(),
  maxRoi: z.number().optional(),
  role: z.string(),
  color: z.number(),
});

// Scraper settings schema
export const ScraperSettingsSchema = z.object({
  timeout: z.number(),
  maxRetries: z.number(),
  useProxies: z.boolean(),
  rotateUserAgents: z.boolean(),
  headless: z.boolean(),
});

// Scheduler settings schema
export const SchedulerSettingsSchema = z.object({
  cycleIntervalSeconds: z.number(),
  batchSize: z.number(),
  maxConcurrentScrapes: z.number(),
});

// Discord settings schema
export const DiscordSettingsSchema = z.object({
  commandPrefix: z.string(),
  enableRolePings: z.boolean(),
  maxEmbedFields: z.number(),
  rateLimitPerMinute: z.number(),
});

// Main configuration schema
export const ConfigSchema = z.object({
  marketplaces: z.array(MarketplaceSchema),
  dealTiers: z.object({
    low: DealTierSchema,
    medium: DealTierSchema,
    high: DealTierSchema,
  }),
  scraper: ScraperSettingsSchema,
  scheduler: SchedulerSettingsSchema,
  discord: DiscordSettingsSchema,
});

export type Config = z.infer<typeof ConfigSchema>;
export type Marketplace = z.infer<typeof MarketplaceSchema>;
export type DealTier = z.infer<typeof DealTierSchema>;
export type ScraperSettings = z.infer<typeof ScraperSettingsSchema>;
export type SchedulerSettings = z.infer<typeof SchedulerSettingsSchema>;
export type DiscordSettings = z.infer<typeof DiscordSettingsSchema>;
