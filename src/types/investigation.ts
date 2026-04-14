import type { FiveW2H, Decision } from './utr'

export interface InvestigationResult {
  fiveW2H: FiveW2H
  tipologi: string
  criminalAssociation: string
  decision: Decision
  reasoning: string
  confidence: number
}
