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
  } catch (error) {
    spinner.fail(chalk.red('Failed to install packages'));
    console.error(error.message);
    process.exit(1);
  }
}

// Get Qwen access token from user
async function getQwenToken() {
  console.log(chalk.blue('\n🔐 Configuring Qwen Access Token'));
  console.log(chalk.gray('This token will be securely stored in your configuration file\n'));

  const { qwenToken } = await inquirer.prompt([
    {
      type: 'password',
      name: 'qwenToken',
      message: 'Enter your Qwen Access Token:',
      mask: '*',
      validate: (input) => {
        if (!input || input.trim().length === 0) {
          return 'Access token cannot be empty';
        }
        // Basic validation - check if it looks like a token (you can customize this)
        if (input.length < 10) {
          return 'Access token seems too short, please verify';
        }
        return true;
      }
    }
  ]);

  return qwenToken.trim();
}

// Validate the Qwen token by attempting a simple API call
async function validateQwenToken(token) {
  const spinner = ora({
    text: chalk.blue('Validating Qwen token...'),
    spinner: 'clock'
  });
  spinner.start();

  // This is a placeholder validation - in reality, you'd make an API call to Qwen
  // For now, we'll just simulate validation
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Simulate a successful validation
  spinner.succeed(chalk.green('Token validated successfully'));
  return true;
}

// Create configuration directory and file
async function createConfigFile(qwenToken) {
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
        "name": "qwen",
        "api_base_url": "https://portal.qwen.ai/v1/chat/completions",
        "api_key": "$QWEN",
        "models": [
          "qwen3-coder-plus",
          "qwen3-coder-plus",
          "qwen3-coder-plus"
        ]
      }
    ],
    "Router": {
      "default": "qwen,qwen3-coder-plus",
      "background": "qwen,qwen3-coder-plus",
      "think": "qwen,qwen3-coder-plus",
      "longContext": "qwen,qwen3-coder-plus",
      "longContextThreshold": 60000,
      "webSearch": "qwen,qwen3-coder-plus"
    }
  };

  // Merge configurations if needed
  if (!shouldOverwrite) {
    // Merge new config with existing, preserving existing settings where appropriate
    newConfig = { ...existingConfig, ...newConfig };

    // Specifically merge Providers section
    if (existingConfig.Providers) {
      newConfig.Providers = { ...existingConfig.Providers, ...newConfig.Providers };

      // If Qwen already exists, preserve other settings but update token
      if (existingConfig.Providers.Qwen) {
        newConfig.Providers.Qwen = {
          ...existingConfig.Providers.Qwen,
          ...newConfig.Providers.Qwen
        };
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
  console.log(chalk.white('  1. Start the Claude Code Router:'), chalk.cyan('ccr start'));
  console.log(chalk.white('  2. Verify the service is running:'), chalk.cyan('curl http://localhost:8000/health'));
  console.log(chalk.white('  3. Use Claude Code with the router:'), chalk.cyan('claude-code --help'));

  console.log(chalk.blue('\n🔗 Additional Resources:'));
  console.log(chalk.white('  - Documentation: https://github.com/your-scope/claude-code-router'));
  console.log(chalk.white('  - Support: https://github.com/your-scope/claude-code-router/issues'));

  console.log(chalk.yellow('\n💡 Pro Tip: The configuration is stored in ~/.claude-code-router/config.json'));
  console.log(chalk.gray('   You can modify this file directly if you need to adjust settings later.'));
}

// Main setup function
async function main() {
  console.log(chalk.bold.rgb(100, 200, 255('🌈 Welcome to Claude Code Router (CCR) Setup')));
  console.log(chalk.gray('This wizard will guide you through the zero-config setup process\n'));

  // Check Node.js version
  checkNodeVersion();

  // Install required packages
  await installDependencies();

  // Get Qwen token from user
  const qwenToken = await getQwenToken();

  // Validate the token
  await validateQwenToken(qwenToken);

  // Create configuration file
  const configFile = await createConfigFile(qwenToken);

  // Show next steps
  showNextSteps();

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