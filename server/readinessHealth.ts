import type { Express } from 'express';
import { pgDbService } from './pgDatabase.js';

export function registerReadinessHealth(app: Express) {
  app.get('/api/ready', async (_req, res) => {
    res.set('Cache-Control', 'no-store');

    const revision =
      process.env.RENDER_GIT_COMMIT || 'unknown';

    if (!pgDbService.isLiveDatabaseConnected()) {
      return res.status(503).json({
        status: 'not_ready',
        database: 'unavailable',
        revision
      });
    }

    try {
      await pgDbService.query('SELECT 1');

      return res.status(200).json({
        status: 'ready',
        database: 'connected',
        revision
      });
    } catch {
      return res.status(503).json({
        status: 'not_ready',
        database: 'unavailable',
        revision
      });
    }
  });
}
