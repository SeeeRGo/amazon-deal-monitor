import Decimal from 'decimal.js';
import { MarketplaceCode } from '../models/product.js';

export interface ScraperConfig {
  timeout: number;
  maxRetries: number;
  useProxies: boolean;
  rotateUserAgents: boolean;
  headless: boolean;
}

export interface ProxyConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  protocol: 'http' | 'https' | 'socks5';
}

export interface ScrapingResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  retryCount: number;
  duration: number;
}

export interface ProductScrapeData {
  asin: string;
  marketplace: MarketplaceCode;
  title: string;
  price: Decimal;
  currency: string;
  availability: boolean;
  rating: number;
  reviewCount: number;
  salesRank: number;
  seller: string;
  isPrime: boolean;
  imageUrl?: string;
  productUrl: string;
  timestamp: Date;
}

export interface CategoryScrapeData {
  asins: string[];
  marketplace: MarketplaceCode;
  categoryUrl: string;
  totalProducts: number;
}

export interface ScrapingStats {
  totalScrapes: number;
  successfulScrapes: number;
  failedScrapes: number;
  averageDuration: number;
  lastScrapeTime: Date;
}
