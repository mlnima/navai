import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'fs'

const generateSkillsIndex = () => {
  const skillsRoot = resolve(__dirname, 'public/skills')
  if (!existsSync(skillsRoot)) {
    mkdirSync(skillsRoot, { recursive: true })
  }
  const entries = readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      name: entry.name,
      path: resolve(skillsRoot, entry.name, 'SKILL.md')
    }))
    .filter((entry) => existsSync(entry.path))
    .map((entry) => ({
      name: entry.name,
      path: `/skills/${entry.name}/SKILL.md`
    }))
  const indexPath = resolve(skillsRoot, 'index.json')
  writeFileSync(indexPath, `${JSON.stringify(entries, null, 2)}\n`, 'utf-8')
}

generateSkillsIndex()

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        content: resolve(__dirname, 'src/content.ts'),
        background: resolve(__dirname, 'src/background.ts')
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]'
      }
    }
  }
})
