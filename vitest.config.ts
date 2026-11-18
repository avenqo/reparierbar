import { defineConfig } from 'vitest/config'

export default defineConfig({ test: { include: ['tests/**/*.test.ts'], env: { PAYLOAD_SECRET: 'test-secret' } } })
