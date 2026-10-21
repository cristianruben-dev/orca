import { createInstance } from 'i18next'
import { describe, expect, it } from 'vitest'

import en from './locales/en.json'

const balanceMessages = [
  ['StatusBar.4025a6f62f', 'Unlimited'],
  ['StatusBar.a95969101f', '{{value0}} credits'],
  ['tooltip.fbc80d8be2', 'Zen balance'],
  ['tooltip.c03c61f53f', 'Balance'],
  ['tooltip.f6a27a3c0a', '{{value0}} available'],
  ['tooltip.7404abbece', 'Usage credits'],
  ['tooltip.473d45cd0f', 'Balance {{value0}}'],
  ['tooltip.f21b2ba897', 'Credits'],
  ['tooltip.56c0d70577', 'Unlimited'],
  ['tooltip.87b5bda4d3', '{{value0}} credits available'],
  [
    'provider.extra.usage.section.apiKeyBalanceUnavailable',
    'Balance is not included in this usage response.'
  ]
] as const

function balanceKey(suffix: string): string {
  return `auto.components.status.bar.${suffix}`
}

describe('provider credit balance English catalog', () => {
  it('retains every English source balance message', async () => {
    const instance = createInstance()
    await instance.init({ lng: 'en', resources: { en: { translation: en } } })

    for (const [suffix, value] of balanceMessages) {
      expect(instance.getResource('en', 'translation', balanceKey(suffix))).toBe(value)
    }
    expect(instance.getResource('en', 'translation', balanceKey('StatusBar.4fba7dc1e7'))).toBe(
      '{{value0}} bal'
    )
  })
})
