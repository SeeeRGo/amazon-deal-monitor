import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { ProxyConfig } from './types.js';
import { logger } from '../utils/logger.js';

export class ProxyManager {
  private proxies: ProxyConfig[] = [];
  private currentIndex = 0;
  private failureCounts: Map<string, number> = new Map();
  private maxFailures = 3;

  constructor(private configPath?: string) {
    this.loadProxies();
  }

  private loadProxies(): void {
    if (this.configPath && existsSync(resolve(process.cwd(), this.configPath))) {
      try {
        const content = readFileSync(resolve(process.cwd(), this.configPath), 'utf8');
        const lines = content.split('\n').filter((line) => line.trim() && !line.startsWith('#'));

        for (const line of lines) {
          const proxy = this.parseProxyLine(line.trim());
          if (proxy) {
            this.proxies.push(proxy);
          }
        }

        logger.info(`Loaded ${this.proxies.length} proxies from ${this.configPath}`);
        return;
      } catch (error) {
        logger.warn(`Failed to load proxies from ${this.configPath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    logger.info('No proxies loaded, running without proxy rotation');
  }

  private parseProxyLine(line: string): ProxyConfig | null {
    try {
      // Format: protocol://host:port or protocol://username:password@host:port
      const urlMatch = line.match(/^(https?|socks5):\/\/(?:([^:]+):([^@]+)@)?([^:]+):(\d+)$/);
      if (!urlMatch) {
        return null;
      }

      const [, protocol, username, password, host, port] = urlMatch;
      return {
        protocol: protocol as 'http' | 'https' | 'socks5',
        host,
        port: parseInt(port, 10),
        username: username || undefined,
        password: password || undefined,
      };
    } catch {
      return null;
    }
  }

  getNextProxy(): ProxyConfig | null {
    if (this.proxies.length === 0) {
      return null;
    }

    let attempts = 0;
    const maxAttempts = this.proxies.length;

    while (attempts < maxAttempts) {
      const proxy = this.proxies[this.currentIndex];
      const proxyKey = `${proxy.host}:${proxy.port}`;

      // Check if proxy has failed too many times
      const failures = this.failureCounts.get(proxyKey) || 0;
      if (failures < this.maxFailures) {
        this.currentIndex = (this.currentIndex + 1) % this.proxies.length;
        return proxy;
      }

      this.currentIndex = (this.currentIndex + 1) % this.proxies.length;
      attempts++;
    }

    logger.warn('All proxies have exceeded failure threshold, returning null');
    return null;
  }

  getRandomProxy(): ProxyConfig | null {
    if (this.proxies.length === 0) {
      return null;
    }

    const availableProxies = this.proxies.filter(
      (proxy) => (this.failureCounts.get(`${proxy.host}:${proxy.port}`) || 0) < this.maxFailures
    );

    if (availableProxies.length === 0) {
      return null;
    }

    const index = Math.floor(Math.random() * availableProxies.length);
    return availableProxies[index];
  }

  reportFailure(proxy: ProxyConfig): void {
    const key = `${proxy.host}:${proxy.port}`;
    const currentFailures = this.failureCounts.get(key) || 0;
    this.failureCounts.set(key, currentFailures + 1);
    logger.warn(`Proxy ${key} failure count: ${currentFailures + 1}/${this.maxFailures}`);
  }

  reportSuccess(proxy: ProxyConfig): void {
    const key = `${proxy.host}:${proxy.port}`;
    this.failureCounts.delete(key);
  }

  resetFailureCount(proxy: ProxyConfig): void {
    const key = `${proxy.host}:${proxy.port}`;
    this.failureCounts.delete(key);
  }

  getAvailableCount(): number {
    return this.proxies.filter(
      (proxy) => (this.failureCounts.get(`${proxy.host}:${proxy.port}`) || 0) < this.maxFailures
    ).length;
  }

  getTotalCount(): number {
    return this.proxies.length;
  }

  setMaxFailures(max: number): void {
    this.maxFailures = max;
  }
}
