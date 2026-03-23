import { createContext, useContext, useState } from 'react'
import { en, type TranslationKey } from '@/locales/en'
import { zh } from '@/locales/zh'

export type Lang = 'en' | 'zh'

const translations: Record<Lang, Record<TranslationKey, string>> = { en, zh }

interface I18nContextValue {
  lang: Lang
  t: (key: TranslationKey) => string
  toggleLang: () => void
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>(() =>
    (localStorage.getItem('ucli-lang') as Lang) ?? 'en',
  )

  function t(key: TranslationKey): string {
    return translations[lang][key]
  }

  function toggleLang() {
    const next: Lang = lang === 'en' ? 'zh' : 'en'
    setLang(next)
    localStorage.setItem('ucli-lang', next)
  }

  return (
    <I18nContext.Provider value={{ lang, t, toggleLang }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider')
  return ctx
}
