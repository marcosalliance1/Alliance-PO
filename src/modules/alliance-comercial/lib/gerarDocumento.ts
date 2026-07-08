import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'

export async function gerarDocumentoDocx(
  templateUrl: string,
  dados: Record<string, string>,
): Promise<Blob> {
  const response = await fetch(templateUrl)
  if (!response.ok) {
    throw new Error(`Falha ao carregar o template (HTTP ${response.status})`)
  }

  const arrayBuffer = await response.arrayBuffer()
  const zip = new PizZip(arrayBuffer)

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
  })

  doc.render(dados)

  return doc.getZip().generate({
    type: 'blob',
    mimeType:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  }) as Blob
}
