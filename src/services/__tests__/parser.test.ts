import { describe, it, expect } from 'vitest'
import { UTRDocumentParser } from '@/services/parser'

const parser = new UTRDocumentParser()

describe('UTRDocumentParser.extractUTRMetadata', () => {
  describe('UTR number extraction from filename', () => {
    it('extracts UTR number with dash separator', () => {
      const { utrNumber } = parser.extractUTRMetadata(
        'UTR-2026-001234-analysis.docx',
        ''
      )
      expect(utrNumber).toBe('UTR-2026-001234')
    })

    it('extracts UTR number with underscore separator', () => {
      const { utrNumber } = parser.extractUTRMetadata(
        'UTR_2026_123.docx',
        ''
      )
      expect(utrNumber).toBe('UTR-2026-000123')
    })

    it('pads the sequence number to 6 digits', () => {
      const { utrNumber } = parser.extractUTRMetadata(
        'UTR-2026-42-analysis.docx',
        ''
      )
      expect(utrNumber).toBe('UTR-2026-000042')
    })

    it('is case-insensitive for the UTR prefix', () => {
      const { utrNumber } = parser.extractUTRMetadata(
        'utr-2026-000099-analysis.docx',
        ''
      )
      expect(utrNumber).toBe('UTR-2026-000099')
    })
  })

  describe('UTR number extraction from narrative fallback', () => {
    it('falls back to narrative when filename has no UTR number', () => {
      const { utrNumber } = parser.extractUTRMetadata(
        'analysis.docx',
        'This is the UTR-2026-005678 case analysis.'
      )
      expect(utrNumber).toBe('UTR-2026-005678')
    })

    it('uses filename match over narrative when both present', () => {
      const { utrNumber } = parser.extractUTRMetadata(
        'UTR-2026-000001-analysis.docx',
        'This references UTR-2026-999999 for comparison.'
      )
      expect(utrNumber).toBe('UTR-2026-000001')
    })
  })

  describe('UTR number fallback when not found', () => {
    it('returns UTR-UNKNOWN-{timestamp} when no UTR number in filename or narrative', () => {
      const { utrNumber } = parser.extractUTRMetadata(
        'analysis-document.docx',
        'No UTR reference here.'
      )
      expect(utrNumber).toMatch(/^UTR-UNKNOWN-\d+$/)
    })
  })

  describe('user name extraction', () => {
    it('extracts name following "Nama:" pattern', () => {
      const { userName } = parser.extractUTRMetadata(
        'UTR-2026-000001.docx',
        'Nama: Budi Santoso\nSomething else'
      )
      expect(userName).toBe('Budi Santoso')
    })

    it('extracts name followed by a comma', () => {
      const { userName } = parser.extractUTRMetadata(
        'UTR-2026-000001.docx',
        'Nama: Ani Wijaya, CIF: 12345'
      )
      expect(userName).toBe('Ani Wijaya')
    })

    it('extracts name stopped by CIF keyword', () => {
      const { userName } = parser.extractUTRMetadata(
        'UTR-2026-000001.docx',
        'Nama: Siti Rahayu CIF123456'
      )
      expect(userName).toBe('Siti Rahayu')
    })

    it('returns "Unknown User" when no name pattern found', () => {
      const { userName } = parser.extractUTRMetadata(
        'UTR-2026-000001.docx',
        'No name information provided.'
      )
      expect(userName).toBe('Unknown User')
    })

    it('returns "Unknown User" when name does not start with capital letter', () => {
      const { userName } = parser.extractUTRMetadata(
        'UTR-2026-000001.docx',
        'Nama: 123invalid'
      )
      expect(userName).toBe('Unknown User')
    })
  })
})
