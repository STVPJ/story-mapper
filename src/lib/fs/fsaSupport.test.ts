import { afterEach, describe, expect, it, vi } from 'vitest'
import { isFsaSupported } from './fsaSupport'

describe('isFsaSupported', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    // jsdom defines window.showDirectoryPicker on neither path; ensure clean
    delete (window as unknown as Record<string, unknown>).showDirectoryPicker
  })

  it('is true when showDirectoryPicker exists in a secure context', () => {
    ;(window as unknown as Record<string, unknown>).showDirectoryPicker = () => {}
    vi.stubGlobal('isSecureContext', true)
    expect(isFsaSupported()).toBe(true)
  })

  it('is false when showDirectoryPicker is absent (Firefox/Safari)', () => {
    vi.stubGlobal('isSecureContext', true)
    expect(isFsaSupported()).toBe(false)
  })

  it('is false in an insecure context even if the API exists', () => {
    ;(window as unknown as Record<string, unknown>).showDirectoryPicker = () => {}
    vi.stubGlobal('isSecureContext', false)
    expect(isFsaSupported()).toBe(false)
  })
})
