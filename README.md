# Amazon Deal Monitoring System

An automated Amazon deal monitoring system that detects, analyzes, and posts high-quality reseller deals directly into Discord.

## 📋 Features

- **Multi-Marketplace Support**: Monitor Amazon DE, FR, IT, and ES marketplaces
- **Real-Time Monitoring**: Detect price changes and arbitrage opportunities
- **Smart Filtering**: Filter deals by margin, ROI, and sales performance
- **Discord Integration**: Post deals with rich embeds and role-based pings
- **User Customization**: Users can set their own thresholds and preferences
- **Anti-Detection**: Built-in proxy rotation and user agent management

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- pnpm (recommended) or npm

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd amazon-deal-monitor
```

2. Install dependencies:
```bash
pnpm install
```

### Demo Mode (No Configuration Required)

Test the core functionality without setting up Discord or external APIs:

```bash
pnpm demo
```

This will run a demo that tests:
- Configuration loading
- Deal analysis with mock data
- Deal tracking and filtering
- Price history tracking
- Deal classification by tier

### Full Application Setup

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Configure your environment variables in `.env`:
```bash
# Discord Configuration
DISCORD_BOT_TOKEN=your_bot_token_here
DISCORD_GUILD_ID=your_guild_id
DISCORD_DEALS_CHANNEL_ID=channel_id

# Amazon Fee API
AMAZON_FEE_API_KEY=your_api_key
AMAZON_FEE_API_URL=https://api.example.com
```

3. Start the application:
```bash
pnpm dev
```

## 📁 Project Structure

```
amazon-deal-monitor/
├── src/
│   ├── config/          # Configuration management
│   ├── scraper/         # Amazon scraping engine
│   ├── analyzer/        # Deal analysis and calculations
│   ├── tracker/         # Price tracking and filtering
│   ├── discord/         # Discord bot integration
│   ├── scheduler/       # Task scheduling
│   ├── models/          # Data models
│   ├── utils/           # Utility functions
│   └── api/             # External API clients
├── tests/               # Test files
├── config/              # Configuration files
└── dist/                # Compiled output
```

## 🔧 Configuration

### Configuration File

Edit `config/config.yaml` to customize:

- Marketplaces to monitor
- Deal tier thresholds
- Scraper settings
- Scheduler settings
- Discord settings

### Environment Variables

See `.env.example` for all available environment variables.

## 🤖 Discord Commands

| Command | Description |
|---------|-------------|
| `!set-margin <percentage>` | Set minimum margin threshold |
| `!set-roi <percentage>` | Set minimum ROI threshold |
| `!add-asin <asin>` | Add ASIN to watchlist |
| `!remove-asin <asin>` | Remove ASIN from watchlist |
| `!add-category <url>` | Add category to watchlist |
| `!my-settings` | View your current settings |
| `!toggle-marketplace <code>` | Enable/disable marketplace |
| `!help` | Show all commands |

## 🧪 Testing

Run tests:
```bash
pnpm test
```

Run tests with coverage:
```bash
pnpm test:coverage
```

## 🏗️ Building

Build the project:
```bash
pnpm build
```

Run the built version:
```bash
pnpm start
```

## 📊 Deal Tiers

| Tier | Margin | ROI | Discord Role |
|------|--------|-----|--------------|
| Low | 25-35% | 100-150% | @Low-Margin |
| Medium | 35-50% | 150-250% | @Medium-Margin |
| High | 50%+ | 250%+ | @High-Margin |

## 🔐 Security

- Never commit `.env` files
- Use strong bot tokens
- Rotate API keys regularly
- Keep dependencies updated

## 📝 License

MIT

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## 📞 Support

For issues and questions, please open an issue on GitHub.
