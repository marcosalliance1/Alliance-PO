// Só para rodar os testes/verificações em Node: resolve imports TypeScript sem extensão ("./x" → "./x.ts").
import { register } from 'node:module'

register('data:text/javascript,' + encodeURIComponent(`
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
export async function resolve(specifier, context, next) {
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && !/\\.[a-z]+$/i.test(specifier) && context.parentURL) {
    const candidato = new URL(specifier + '.ts', context.parentURL)
    if (existsSync(fileURLToPath(candidato))) return next(candidato.href, context)
  }
  return next(specifier, context)
}
`), import.meta.url)
