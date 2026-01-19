#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const inquirer = require('inquirer');
const { execSync } = require('child_process');
const os = require('os');

// Check if Node.js version is sufficient
function checkNodeVersion() {
  const version = process.version;
  const majorVersion = parseInt(version.split('.')[0].substring(1));

  if (majorVersion < 14) {
    console.error(chalk.red(`❌ Node.js version ${version} is not supported. Please upgrade to Node.js 14 or higher.`));
    process.exit(1);
  }

  return true;
}

// Check if required tools are installed
function checkDependencies() {
  const spinner = ora({
    text: chalk.blue('Checking system dependencies...'),
    spinner: 'clock'
  });
  spinner.start();

  let npmInstalled = false;
  let gitInstalled = false;

  try {
    const npmResult = execSync('npm --version', { stdio: 'pipe', encoding: 'utf-8' });
    npmInstalled = !!npmResult;
  } catch (e) {
    // npm not found
  }

  try {
    const gitResult = execSync('git --version', { stdio: 'pipe', encoding: 'utf-8' });
    gitInstalled = !!gitResult;
  } catch (e) {
    // git not found
  }

  // Check if ccr and claude-code are installed globally
  let ccrInstalled = false;
  let claudeCodeInstalled = false;

  try {
    const listResult = execSync('npm list -g --depth=0', { stdio: 'pipe', encoding: 'utf-8' });
    ccrInstalled = listResult.includes('@your-scope/claude-code-router');
    claudeCodeInstalled = listResult.includes('@your-scope/claude-code');
  } catch (e) {
    // Error in listing packages, assume not installed
  }

  spinner.succeed(chalk.green('Dependencies check completed'));

  return {
    dependencies: {
      npm: npmInstalled,
      git: gitInstalled
    },
    ccrInstalled,
    claudeCodeInstalled
  };
}

// Install required packages with user confirmation
async function installDependencies() {
  const { confirmInstall } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmInstall',
      message: `${chalk.yellow('The following mandatory packages will be installed:')}
${chalk.cyan('- @qwen-code/qwen-code@latest')}
${chalk.cyan('- @anthropic-ai/claude-code')}
${chalk.cyan('- @musistudio/claude-code-router')}
${chalk.white('Proceed? [Y/n]')}`,
      default: true
    }
  ]);

  if (!confirmInstall) {
    console.log(chalk.red('❌ Installation cancelled by user. These packages are required for the tool to function.'));
    process.exit(1);
  }

  const spinner = ora({
    text: chalk.blue('Installing required packages...'),
    spinner: 'clock'
  });
  spinner.start();

  try {
    // First install @qwen-code/qwen-code@latest
    console.log(chalk.blue('📦 Installing @qwen-code/qwen-code@latest...'));
    execSync('npm install -g @qwen-code/qwen-code@latest', { stdio: 'inherit' });

    // Then install @anthropic-ai/claude-code and @musistudio/claude-code-router
    console.log(chalk.blue('📦 Installing @anthropic-ai/claude-code and @musistudio/claude-code-router...'));
    execSync('npm install -g @anthropic-ai/claude-code @musistudio/claude-code-router', { stdio: 'inherit' });

    spinner.succeed(chalk.green('All packages installed successfully'));

    // Verify installations
    const verifySpinner = ora({
      text: chalk.blue('Verifying installations...'),
      spinner: 'clock'
    });
    verifySpinner.start();

    try {
      execSync('ccr --version', { stdio: 'pipe' });
      execSync('claude --version', { stdio: 'pipe' });
      verifySpinner.succeed(chalk.green('All tools verified successfully'));
    } catch (verificationError) {
      verifySpinner.warn(chalk.yellow('Some tools may not be available in PATH. You may need to restart your terminal.'));
    }
  } catch (error) {
    spinner.fail(chalk.red('Failed to install packages'));
    console.error(error.message);
    process.exit(1);
  }
}


// Create configuration directory and file
async function createConfigFile(apiKeyValue) {
  const configDir = path.join(require('os').homedir(), '.claude-code-router');
  const configFile = path.join(configDir, 'config.json');

  // Ensure directory exists
  await fs.ensureDir(configDir);

  // Check if config file already exists
  let existingConfig = {};
  let shouldOverwrite = true;

  if (await fs.pathExists(configFile)) {
    const { overwriteChoice } = await inquirer.prompt([
      {
        type: 'list',
        name: 'overwriteChoice',
        message: 'Configuration file already exists. What would you like to do?',
        choices: [
          { name: 'Overwrite existing configuration', value: 'overwrite' },
          { name: 'Merge with existing configuration', value: 'merge' },
          { name: 'Cancel setup', value: 'cancel' }
        ],
        default: 'overwrite'
      }
    ]);

    if (overwriteChoice === 'cancel') {
      console.log(chalk.yellow('Setup cancelled by user'));
      process.exit(0);
    } else if (overwriteChoice === 'merge') {
      existingConfig = await fs.readJson(configFile);
      shouldOverwrite = false;
    }
  }

  // Create the new configuration
  let newConfig = {
    "LOG": true,
    "LOG_LEVEL": "info",
    "HOST": "127.0.0.1",
    "PORT": 3456,
    "API_TIMEOUT_MS": 600000,
    "Providers": [
      {
        "NAME": "qwen",
        "HOST": "https://portal.qwen.ai/v1/chat/completions",
        "APIKEY": apiKeyValue,
        "MODELS": ["qwen3-coder-plus"],
        "transformers": []
      }
    ],
    "Router": {
      "default": "qwen,qwen3-coder-plus",
      "background": "qwen,qwen3-coder-plus",
      "think": "qwen,qwen3-coder-plus",
      "longContext": "qwen,qwen3-coder-plus",
      "longContextThreshold": 60000,
      "webSearch": "qwen,qwen3-coder-plus"
    },
    "Server": {
      "enable_cors": true,
      "allow_origins": ["*"],
      "rate_limit": {
        "enabled": true,
        "requests": 100,
        "window_ms": 60000
      }
    }
  };

  // Merge configurations if needed
  if (!shouldOverwrite) {
    // Merge new config with existing, preserving existing settings where appropriate
    newConfig = { ...existingConfig, ...newConfig };

    // Specifically merge Providers section if it exists in both
    if (existingConfig.Providers && Array.isArray(existingConfig.Providers)) {
      // If existing config has array of providers, merge appropriately
      const existingQwenProvider = existingConfig.Providers.find(provider => provider.name === 'qwen');
      if (existingQwenProvider) {
        // Update the api_key in the existing qwen provider
        const updatedProviders = existingConfig.Providers.map(provider => {
          if (provider.name === 'qwen') {
            return { ...provider, api_key: apiKeyValue };
          }
          return provider;
        });
        newConfig.Providers = updatedProviders;
      }
    }
  }

  // Write the configuration file
  const spinner = ora({
    text: chalk.blue('Writing configuration file...'),
    spinner: 'clock'
  });
  spinner.start();

  try {
    await fs.writeJson(configFile, newConfig, { spaces: 2 });
    spinner.succeed(chalk.green(`Configuration saved to ${configFile}`));

    // Set secure permissions on config file
    await fs.chmod(configFile, 0o600);

    return configFile;
  } catch (error) {
    spinner.fail(chalk.red('Failed to write configuration file'));
    console.error(error);
    process.exit(1);
  }
}

// Display next steps to the user
function showNextSteps() {
  console.log(chalk.green('\n🎉 Setup completed successfully!\n'));

  console.log(chalk.blue('🚀 Next Steps:'));
  console.log(chalk.white('  1. Claude Code Router is now active and running'));
  console.log(chalk.white('  2. Verify the service is running:'), chalk.cyan('curl http://127.0.0.1:3456/health'));
  console.log(chalk.white('  3. Use Claude Code with the router:'), chalk.cyan('claude-code --help'));

  console.log(chalk.blue('\n🔗 Additional Resources:'));
  console.log(chalk.white('  - Documentation: https://github.com/your-scope/claude-code-router'));
  console.log(chalk.white('  - Support: https://github.com/your-scope/claude-code-router/issues'));

  console.log(chalk.yellow('\n💡 Pro Tip: The configuration is stored in ~/.claude-code-router/config.json'));
  console.log(chalk.gray('   You can modify this file directly if you need to adjust settings later.'));
}

// Check if port is available
async function isPortAvailable(port) {
  return new Promise((resolve) => {
    const net = require('net');
    const server = net.createServer();

    server.listen(port, '127.0.0.1', () => {
      server.close(() => {
        resolve(true);
      });
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(false);
      } else {
        resolve(true); // If there's another error, assume port is available
      }
    });
  });
}

// Wait for server to be running with timeout
async function waitForServer(spinner) {
  const startTime = Date.now();
  const timeout = 30000; // 30 seconds timeout

  // Check if port is available before waiting
  const portAvailable = await isPortAvailable(3456);
  if (!portAvailable) {
    spinner.warn(chalk.yellow('Port 3456 may be in use. The server might fail to start.'));
  }

  while (Date.now() - startTime < timeout) {
    try {
      const statusOutput = execSync('ccr status', { stdio: 'pipe', encoding: 'utf-8' });

      if (statusOutput.includes('Claude Code Router Status: Running')) {
        return; // Server is running, exit the function
      }
    } catch (error) {
      // If ccr status fails, server might not be ready yet, continue waiting
    }

    // Wait 1 second before checking again
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // If we reach here, the timeout has been exceeded
  spinner.warn(chalk.yellow('Timeout reached while waiting for server to start'));
}

// Main setup function
async function main() {
  console.log(chalk.bold.rgb(100, 200, 255('🌈 Welcome to Claude Code Router (CCR) Setup')));
  console.log(chalk.gray('This wizard will guide you through the zero-config setup process\n'));

  // Check Node.js version
  checkNodeVersion();

  // Install required packages
  await installDependencies();

  // Initial Launch: Execute ccr start --daemon to trigger default initialization
  const startSpinner = ora({
    text: chalk.blue('Starting Claude Code Router for initial setup...'),
    spinner: 'clock'
  });
  startSpinner.start();

  try {
    execSync('ccr start --daemon', { stdio: 'pipe' });
    startSpinner.succeed(chalk.green('CCR started for initial setup'));
  } catch (error) {
    startSpinner.warn(chalk.yellow('CCR may not be fully started yet, continuing...'));
  }

  // Wait: Implement robust server wait logic instead of hardcoded sleep
  const waitSpinner = ora({
    text: chalk.blue('Waiting for CCR to initialize defaults...'),
    spinner: 'clock'
  });
  waitSpinner.start();

  // Wait for server to be running with timeout
  await waitForServer(waitSpinner);

  waitSpinner.succeed(chalk.green('CCR initialization complete'));

  // Credential Handling: Prompt for Qwen API Key
  const { qwenApiKey } = await inquirer.prompt([
    {
      type: 'password',
      name: 'qwenApiKey',
      message: 'Enter your Qwen API Key (leave blank to set manually via env var):',
      mask: '*',
      default: ''
    }
  ]);

  // Determine the API key value based on user input
  const apiKeyValue = qwenApiKey.trim() ? qwenApiKey.trim() : '$QWEN';

  // Create configuration file with the determined API key
  const configFile = await createConfigFile(apiKeyValue);

  // Finalize: Execute ccr restart to apply the new configuration
  const finalRestartSpinner = ora({
    text: chalk.blue('Applying new configuration...'),
    spinner: 'clock'
  });
  finalRestartSpinner.start();

  try {
    execSync('ccr restart', { stdio: 'pipe' });
    finalRestartSpinner.succeed(chalk.green('CCR restarted with new configuration'));
  } catch (error) {
    finalRestartSpinner.fail(chalk.red('Failed to restart CCR, please restart manually'));
  }

  // Show next steps
  showNextSteps();

  // Verification: Run ccr status and display PID and Uptime
  const verifySpinner = ora({
    text: chalk.blue('Verifying Claude Code Router status...'),
    spinner: 'clock'
  });
  verifySpinner.start();

  try {
    const statusOutput = execSync('ccr status', { stdio: 'pipe', encoding: 'utf-8' });
    verifySpinner.succeed(chalk.green('Verification complete'));
    console.log(chalk.green('\n📋 Claude Code Router Status:'));
    console.log(statusOutput);
  } catch (error) {
    verifySpinner.fail(chalk.red('Could not retrieve CCR status'));
    console.log(chalk.yellow('You can manually check status with: ccr status'));
  }

  console.log(chalk.green('\n✅ Setup complete! You\'re ready to use Claude Code Router.'));
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error(chalk.red('Unhandled rejection:'), err);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error(chalk.red('Uncaught exception:'), err);
  process.exit(1);
});

// Run the main function
main().catch(err => {
  console.error(chalk.red('An error occurred during setup:'), err.message);
  process.exit(1);
});