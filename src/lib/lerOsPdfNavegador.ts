// Leitura do PDF no navegador (pdf.js, da Mozilla). O arquivo não sai do computador do usuário.
// API conferida nos tipos que vêm no próprio pacote pdfjs-dist 6.5.438:
//   GlobalWorkerOptions.workerSrc (obrigatório), getDocument({ data }).promise, page.getTextContent().
// pdf.js é carregado sob demanda para não pesar o resto do app.

import { interpretarOs, paginasDoDoc, OsInvalidaErro, type OsLida } from './lerOsPdf'

export async function lerOsPdf(buffer: ArrayBuffer): Promise<OsLida> {
  const pdfjs = await import('pdfjs-dist')
  const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = worker
  const tarefa = pdfjs.getDocument({ data: new Uint8Array(buffer) })
  try {
    let doc
    try {
      doc = await tarefa.promise
    } catch {
      throw new OsInvalidaErro('Não consegui abrir este arquivo como PDF.')
    }
    return interpretarOs(await paginasDoDoc(doc))
  } finally {
    void tarefa.destroy()
  }
}

export { OsInvalidaErro }
