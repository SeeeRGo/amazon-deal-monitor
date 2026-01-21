import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { logger } from '../utils/logger.js';

export interface UserAgent {
  userAgent: string;
  platform: string;
  browser: string;
}

export class UserAgentManager {
  private userAgents: UserAgent[] = [];
  private currentIndex = 0;

  constructor(private configPath?: string) {
    this.loadUserAgents();
  }

  private loadUserAgents(): void {
    const defaultUserAgents: UserAgent[] = [
      {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        platform: 'Windows',
        browser: 'Chrome',
      },
      {
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        platform: 'MacOS',
        browser: 'Chrome',
      },
      {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
        platform: 'Windows',
        browser: 'Firefox',
      },
      {
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
        platform: 'MacOS',
        browser: 'Safari',
      },
      {
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        platform: 'Linux',
        browser: 'Chrome',
      },
    ];

    if (this.configPath && existsSync(resolve(process.cwd(), this.configPath))) {
      try {
        const content = readFileSync(resolve(process.cwd(), this.configPath), 'utf8');
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.userAgents = parsed;
          logger.info(`Loaded ${this.userAgents.length} user agents from ${this.configPath}`);
          return;
        }
      } catch (error) {
        logger.warn(`Failed to load user agents from ${this.configPath}, using defaults`);
      }
    }

    this.userAgents = defaultUserAgents;
    logger.info(`Using ${this.userAgents.length} default user agents`);
  }

  getRandomUserAgent(): string {
    if (this.userAgents.length === 0) {
      return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    }

    const index = Math.floor(Math.random() * this.userAgents.length);
    return this.userAgents[index].userAgent;
  }

  getNextUserAgent(): string {
    if (this.userAgents.length === 0) {
      return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    }

    const userAgent = this.userAgents[this.currentIndex].userAgent;
    this.currentIndex = (this.currentIndex + 1) % this.userAgents.length;
    return userAgent;
  }

  getUserAgentByPlatform(platform: string): string | null {
    const found = this.userAgents.find((ua) => ua.platform.toLowerCase() === platform.toLowerCase());
    return found?.userAgent || null;
  }

  getUserAgentByBrowser(browser: string): string | null {
    const found = this.userAgents.find((ua) => ua.browser.toLowerCase() === browser.toLowerCase());
    return found?.userAgent || null;
  }

  getCount(): number {
    return this.userAgents.length;
  }
}
