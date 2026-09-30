import service from './service.json'
import privacy from './privacy.json'
import closure from './closure.json'

export type LegalDocumentKind = 'service' | 'privacy' | 'closure'
export type LegalRun = { text: string; bold?: boolean; underline?: boolean }
export type LegalBlock =
  | { kind: 'heading'; id: string; text: string }
  | { kind: 'paragraph'; id: string; runs: LegalRun[] }
  | { kind: 'table'; id: string; hasHeader: boolean; rows: string[][] }
export type LegalDocument = {
  id: LegalDocumentKind
  title: string
  navTitle: string
  effectiveLabel: string
  sourceFile: string
  sourceSha256: string
  sourceContents: string[]
  blocks: LegalBlock[]
}

const documents: Record<LegalDocumentKind, LegalDocument> = {
  service: service as LegalDocument,
  privacy: privacy as LegalDocument,
  closure: closure as LegalDocument,
}
export const legalLinks: { kind: LegalDocumentKind; label: string }[] = [
  { kind: 'service', label: '用户协议' },
  { kind: 'privacy', label: '隐私政策' },
  { kind: 'closure', label: '账号注销协议' },
]

export function getLegalDocument(value: unknown): LegalDocument | undefined {
  if (value === 'service' || value === 'privacy' || value === 'closure') return documents[value]
}
export function legalDocumentUrl(kind: LegalDocumentKind): string {
  return `/pages/legal/document?type=${kind}`
}
export function openLegalDocument(kind: LegalDocumentKind) {
  uni.navigateTo({ url: legalDocumentUrl(kind) })
}
