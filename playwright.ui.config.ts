import { defineConfig } from '@playwright/test';
import base from './playwright.design.config';

export default defineConfig({ ...base, testMatch: ['auth-loop.spec.ts', 'directory-sync.spec.ts', 'local-directory.spec.ts', 'dashboard-proposal.spec.ts', 'home-dashboard.spec.ts'] });
