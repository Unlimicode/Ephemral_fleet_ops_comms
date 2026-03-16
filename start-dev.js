import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, 'backend/.env') });

import ngrok from '@ngrok/ngrok';
import { spawn } from 'child_process';
import { writeFileSync } from 'fs';

console.log('🚀 Starting SwiftLink dev environment...\n');

// Open ngrok tunnel to backend port 3001
const listener = await ngrok.forward({
    addr: 3001,
    authtoken: process.env.NGROK_AUTHTOKEN?.trim(),
});

const tunnelUrl = listener.url();
console.log(`🌐 ngrok tunnel: ${tunnelUrl}`);
console.log(`📱 On your phone open: http://YOUR_PC_IP:5173\n`);

// Write the tunnel URL into frontend/.env.local
// Vite reads .env.local automatically and it overrides .env
// This file is gitignored so it is never committed
const envLocalContent = `VITE_API_URL=${tunnelUrl}/api\nVITE_WS_URL=${tunnelUrl}\n`;
writeFileSync(resolve(__dirname, 'frontend/.env.local'), envLocalContent);
console.log('✅ frontend/.env.local updated with tunnel URL\n');

// Start the backend server
const backend = spawn('npm', ['run', 'dev'], {
    cwd: resolve(__dirname, 'backend'),
    stdio: 'inherit',
    shell: true,
    env: {
        ...process.env,
        CLIENT_ORIGIN: 'http://localhost:5173',
    },
});

backend.on('error', (err) => {
    console.error('❌ Backend failed to start:', err.message);
});

// Start the frontend dev server with --host
// --host exposes it on the local network so phones can connect
const frontend = spawn('npm', ['run', 'dev', '--', '--host'], {
    cwd: resolve(__dirname, 'frontend'),
    stdio: 'inherit',
    shell: true,
});

frontend.on('error', (err) => {
    console.error('❌ Frontend failed to start:', err.message);
});

// Clean up everything on Ctrl+C
process.on('SIGINT', async () => {
    console.log('\n\nShutting down SwiftLink...');
    try {
        await ngrok.disconnect();
        console.log('✅ ngrok tunnel closed');
    } catch {
        // ignore disconnect errors
    }
    backend.kill();
    frontend.kill();
    console.log('✅ Servers stopped');
    process.exit(0);
});
