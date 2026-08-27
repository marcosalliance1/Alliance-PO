import React from 'react'
import { ExternalLink, Library } from 'lucide-react'

// Sistema de catálogo (fornecedores + atrações) — hospedado separadamente.
// Por enquanto embutido via iframe; a integração de dados (auto-preencher
// fornecedor no orçamento) é uma fase futura.
const CATALOGO_URL = 'https://fornecedores-atracoes.vercel.app'

export const CatalogoPage: React.FC = () => {
  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 130px)' }}>
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div>
          <h1 className="text-white font-bold text-xl flex items-center gap-2">
            <Library className="w-5 h-5 text-accent" /> Catálogo
          </h1>
          <p className="text-muted text-sm">Fornecedores e atrações — sempre a versão mais atual do sistema.</p>
        </div>
        <a href={CATALOGO_URL} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 border border-bordercol text-muted hover:text-white hover:bg-white/5 text-sm py-2 px-3 rounded-lg transition-colors">
          <ExternalLink className="w-4 h-4" /> Abrir em nova aba
        </a>
      </div>

      <div className="flex-1 rounded-card overflow-hidden border border-bordercol bg-surface-2 min-h-[500px]">
        <iframe
          src={CATALOGO_URL}
          title="Catálogo de fornecedores e atrações"
          className="w-full h-full"
          style={{ border: 'none', minHeight: 500 }}
        />
      </div>

      <p className="text-[11px] text-muted/70 mt-2">
        Não carregou aqui? O sistema pode bloquear ser embutido — use <b>Abrir em nova aba</b>.
      </p>
    </div>
  )
}
