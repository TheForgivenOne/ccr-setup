# Claude Code Router (CCR) Setup

A zero-config setup tool for the Claude Code Router (CCR) project that provides an interactive CLI for configuring your environment.

## Features

- ✅ Interactive configuration wizard
- ✅ Automatic dependency checking
- ✅ Secure token storage
- ✅ Idempotent configuration
- ✅ Colored output and progress indicators
- ✅ No manual shell profile editing required

## Prerequisites

- Node.js 14 or higher
- npm

## Installation and Usage

### Option 1: Run with npx (Recommended)

```bash
npx @your-scope/ccr-setup
```

### Option 2: Global Installation

```bash
npm install -g @your-scope/ccr-setup
ccr-setup
```

## Configuration

The tool will create a configuration file at `~/.claude-code-router/config.json` with the following structure:

```json
{
  "LogLevel": "debug",
  "Server": {
    "Host": "0.0.0.0",
    "Port": 8000,
    "Timeout": 300,
    "AllowOrigins": ["*"],
    "AllowHeaders": ["*"],
    "AllowMethods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
  },
  "Providers": {
    "Qwen": {
      "AccessTokens": ["YOUR_TOKEN_HERE"],
      "Model": "qwen-max",
      "BaseURL": "https://dashscope.aliyuncs.com/compatible-mode/v1"
    }
  },
  "Routes": [
    {
      "Path": "/v1/chat/completions",
      "Provider": "Qwen",
      "Models": ["qwen-max"]
    }
  ],
  "Middleware": {
    "RateLimit": {
      "Enabled": true,
      "Requests": 100,
      "Window": 60
    },
    "Logging": {
      "Enabled": true
    }
  }
}
```

## Next Steps

After successful setup:

1. Start the Claude Code Router:
```bash
ccr start
```

2. Verify the service is running:
```bash
curl http://localhost:8000/health
```

3. Use Claude Code with the router:
```bash
claude-code --help
```

## Development

To run the CLI tool locally during development:

```bash
node index.js
```

## Security

- Access tokens are stored in a secure configuration file with restricted permissions (600)
- No tokens are stored in shell profiles or environment variables
- The configuration file is created in the user's home directory under `.claude-code-router/`

## Troubleshooting

If you encounter any issues:

1. Make sure you have Node.js 14+ installed
2. Check that npm is working correctly
3. Ensure you have sufficient permissions to install global packages
4. Verify that the Qwen Access Token is valid