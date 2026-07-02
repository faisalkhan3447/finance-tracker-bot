# Discord Finance Tracker Bot

A professional, production-ready Discord bot built with Node.js and better-sqlite3 that acts as a robust personal finance tracker for a single server.

## Features

- **Single Truth Currency System**: Uses a configurable fixed exchange rate, storing all values in INR internally.
- **Smart Transaction Parsing**: Extract amounts and reasons from natural chat messages (e.g., `+5$ Sold Plugin`, `Hosting -250rs`).
- **Atomic Transactions**: Guarantees zero data corruption or race conditions during simultaneous messages.
- **Live Dashboard**: A beautiful, auto-updating, single-message embed showing today's stats, net profit, and recent transactions.
- **Audit Logging**: Logs every change with built-in action buttons (`[Undo]`, `[Restore]`, `[View]`).
- **Resilience**: Features tiered SQLite backups (Daily, Weekly, Monthly) and automatic state recovery on restart.
- **Advanced Export & Search**: Query history by complex filters and export to CSV or JSON.

## Installation

1. **Clone the project**
   ```bash
   git clone https://github.com/faisalkhan3447/finance-tracker-bot.git
   cd finance-tracker-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment**
   Rename `.env.example` to `.env` and fill in your details:
   ```env
   BOT_TOKEN=your_bot_token_here
   CLIENT_ID=your_client_id_here
   ```

4. **Discord Developer Portal Setup**
   - Create an application and add a bot.
   - Go to **Bot** -> **Privileged Gateway Intents** and enable **Message Content Intent**.
   - Invite the bot to your server with permissions to View Channels, Send Messages, Embed Links, Read Message History.

5. **Start the Bot**
   ```bash
   npm start
   ```

## Usage

1. Run the interactive `/setup` command in your server to designate the transaction, dashboard, and audit channels.
2. The bot will automatically create the Balance Dashboard.
3. Simply type messages like `+100rs Sold items` in the transaction channel!

## Commands

- `/setup` - Interactive channel and role setup.
- `/config` - View current configuration.
- `/balance` - Quick ephemeral balance check.
- `/stats` - View financial statistics (all-time, monthly, daily).
- `/history` - View recent transactions.
- `/search` - Advanced search (`amount>500`, `reason:hosting`, etc.).
- `/export` - Export history as CSV or JSON.
- `/setrate` - Update the exchange rate.
- `/undo` & `/restore` - Manage transactions safely.
- `/recalculate` - Completely rebuild the balance and fix historical discrepancies.
- `/refresh` - Force the dashboard to recreate/refresh.
- `/info` - Bot health and database size.
- `/reset` - Danger: Wipes the entire database.

## Backup & Recovery
Backups are rotated automatically in the `/backups` folder. To recover from a catastrophic failure, stop the bot, copy a backup over `database/finance.sqlite`, and start it again.