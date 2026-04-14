import Anthropic from '@anthropic-ai/sdk'
import type { Transaction } from '@/types/utr'
import type { InvestigationResult } from '@/types/investigation'

const LTKM_MATRIX = `
Tipologi matrix (LTKM SOP Lampiran 2):
1. Profile deviation — transactions deviating from user profile
2. Structuring/Smurfing — evading reporting thresholds
3. Proceeds of crime — 26 predicate offenses
4. PPATK request — flagged by regulator
5. Terrorism financing — DTTOT/SIPENDAR lists
6. WMD proliferation — DPPSPM list
7. Business termination — from KYC refusal
`

export type { InvestigationResult }

export class InvestigationAgent {
  private client: Anthropic

  constructor(apiKey: string) {
    this.client = new Anthropic({
      apiKey,
      dangerouslyAllowBrowser: true
    })
  }

  async investigate(
    narrative: string,
    transactions: Transaction[],
    userName: string
  ): Promise<InvestigationResult> {
    const txSummary = transactions
      .slice(0, 20)
      .map(
        (t) =>
          `${t.date} | ${t.method} | Rp ${t.amount.toLocaleString('id-ID')} | ${t.origin} → ${t.destination}`
      )
      .join('\n')

    const prompt = `You are an AML compliance investigator for PT EDIK (DANA Indonesia).
Analyze this UTR and return a JSON response.

${LTKM_MATRIX}

User: ${userName}
Total transactions: ${transactions.length}

Analysis narrative:
${narrative.slice(0, 4000)}

Transaction sample (first 20):
${txSummary}

Return ONLY valid JSON in this exact shape:
{
  "fiveW2H": {
    "what": "string",
    "why": "string",
    "who": { "name": "string", "cif": "string" },
    "when": "string",
    "where": "string",
    "how": "string",
    "howMuch": { "count": number, "totalIDR": number }
  },
  "tipologi": "one of the 7 matrix categories",
  "criminalAssociation": "specific predicate offense if applicable",
  "decision": "REPORT" | "NON_REPORT" | "REJECT",
  "reasoning": "brief justification",
  "confidence": number between 0 and 1
}`

    const response = await this.client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text response from Claude')
    }

    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON found in Claude response')

    return JSON.parse(jsonMatch[0]) as InvestigationResult
  }
}
