#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting Solana Market-Making Bot...\n');

// Check if build exists
if (!fs.existsSync('./dist')) {
    console.log('❌ Build not found. Running build first...');
    const buildProcess = spawn('npm', ['run', 'build'], { stdio: 'inherit', shell: true });
    
    buildProcess.on('close', (code) => {
        if (code === 0) {
            console.log('✅ Build completed successfully!');
            startBot();
        } else {
            console.log('❌ Build failed!');
            process.exit(1);
        }
    });
} else {
    startBot();
}

function startBot() {
    console.log('\n🔧 Configuration Check:');
    
    // Check if keystore directory exists
    if (!fs.existsSync('./keystore')) {
        fs.mkdirSync('./keystore');
        console.log('📁 Created keystore directory');
    }
    
    // Check if logs directory exists
    if (!fs.existsSync('./logs')) {
        fs.mkdirSync('./logs');
        console.log('📁 Created logs directory');
    }
    
    // Check if public directory exists
    if (!fs.existsSync('./public')) {
        console.log('❌ Public directory not found for UI');
    } else {
        console.log('✅ UI files found');
    }
    
    console.log('\n📋 Quick Start Guide:');
    console.log('1. Open http://localhost:3000 in your browser');
    console.log('2. Add your wallet using base58 private key');
    console.log('3. Check wallet status and balances');
    console.log('4. Start the bot when ready');
    console.log('\n⚠️  MAINNET WARNING: Only use wallets with small amounts for testing!\n');
    
    console.log('🎬 Starting bot...\n');
    
    // Start the bot
    const botProcess = spawn('node', ['dist/index.js'], { 
        stdio: 'inherit', 
        shell: true,
        cwd: process.cwd()
    });
    
    botProcess.on('close', (code) => {
        console.log(`\n🛑 Bot process exited with code ${code}`);
    });
    
    botProcess.on('error', (error) => {
        console.error(`❌ Failed to start bot: ${error.message}`);
    });
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n🛑 Shutting down bot...');
        botProcess.kill('SIGINT');
    });
    
    process.on('SIGTERM', () => {
        console.log('\n🛑 Shutting down bot...');
        botProcess.kill('SIGTERM');
    });
}
