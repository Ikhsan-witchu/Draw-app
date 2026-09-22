import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function aiApiPlugin(): Plugin {
  return {
    name: 'ai-api-plugin',
    configureServer(server) {
      server.middlewares.use('/api/chat', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });

        req.on('end', async () => {
          try {
            const data = JSON.parse(body);
            const servicePath = './src/services/aiAssistantService';
            const serviceModule = (await import(servicePath)) as {
              processAIChatRequest: (msgs: unknown[]) => Promise<unknown>;
            };
            const result = await serviceModule.processAIChatRequest(
              (data as { messages?: unknown[] }).messages || [],
            );
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            res.end(JSON.stringify(result));
          } catch (err: unknown) {
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 500;
            const message = err instanceof Error ? err.message : 'Server error';
            res.end(JSON.stringify({ error: message }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), aiApiPlugin()],
})