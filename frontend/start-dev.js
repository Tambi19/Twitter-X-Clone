// Custom development server script to ensure proper API proxying
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { createProxyMiddleware } from 'http-proxy-middleware';
import express from 'express';

async function startDevServer() {
  console.log('Starting custom development server with improved proxy...');
  
  const app = express();
  
  // Configure proxy middleware
  app.use('/api', createProxyMiddleware({
    target: 'http://localhost:5000',
    changeOrigin: true,
    // Don't rewrite the path - keep the /api prefix
    // pathRewrite: {
    //   '^/api': ''
    // },
    onProxyReq: (proxyReq, req) => {
      console.log(`Proxying ${req.method} ${req.url} -> http://localhost:5000${req.url}`);
    },
    onProxyRes: (proxyRes, req) => {
      console.log(`Received ${proxyRes.statusCode} for ${req.method} ${req.url}`);
    },
    onError: (err, req) => {
      console.error(`Proxy error for ${req.method} ${req.url}:`, err);
    }
  }));
  
  // Create the Vite server
  const vite = await createServer({
    plugins: [react()],
    server: {
      port: 3000,
      middlewareMode: true,
    },
  });
  
  // Use Vite's middleware
  app.use(vite.middlewares);
  
  // Start the server
  app.listen(3000, () => {
    console.log('Custom dev server running at http://localhost:3000');
    console.log('API requests will be proxied to http://localhost:5000');
  });
}

startDevServer().catch(console.error); 