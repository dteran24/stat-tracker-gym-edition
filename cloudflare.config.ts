import { defineConfig } from 'cf/config';

export default defineConfig({
  worker: {
    name: 'stat-tracker-gym-edition',
    compatibilityDate: '2026-11-25',
    assets: {
      notFoundHandling: 'single-page-application',
    },
  },
});
