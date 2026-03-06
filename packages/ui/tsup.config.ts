import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  external: [
    'react',
    'react-dom',
    'cmdk',
    'radix-ui',
    '@radix-ui/react-slot',
    'class-variance-authority',
    'clsx',
    'react-resizable-panels',
    'shiki',
    'sonner',
    'tailwind-merge',
    'lucide-react',
  ],
  esbuildOptions(options) {
    options.alias = {
      '@': './src',
    }
  },
})
