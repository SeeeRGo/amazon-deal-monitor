import { readFileSync } from 'fs';
import { resolve } from 'path';
import { load } from 'js-yaml';
import { ConfigSchema, type Config } from './settings.js';

let config: Config | null = null;

export function loadConfig(configPath: string = 'config/config.yaml'): Config {
  if (config) {
    return config;
  }

  try {
    const filePath = resolve(process.cwd(), configPath);
    const fileContents = readFileSync(filePath, 'utf8');
    const yamlConfig = load(fileContents) as unknown;
    
    config = ConfigSchema.parse(yamlConfig);
    return config;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to load configuration: ${error.message}`);
    }
    throw new Error('Failed to load configuration: Unknown error');
  }
}

export function getConfig(): Config {
  if (!config) {
    return loadConfig();
  }
  return config;
}

export function reloadConfig(configPath?: string): Config {
  config = null;
  return loadConfig(configPath);
}
