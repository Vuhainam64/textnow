/**
 * i18n.jsx — Lightweight internationalization for TextNow Dashboard
 * ─────────────────────────────────────────────────────────────────
 * Usage:
 *   // Wrap app:
 *   <LanguageProvider><App /></LanguageProvider>
 *
 *   // In any component:
 *   import { useT } from '../lib/i18n'
 *   const t = useT()
 *   t('common.save')           // → 'Lưu' or 'Save'
 *   t('accounts.title')        // → 'Tài khoản' or 'Accounts'
 *   t('workflow.steps', { count: 5 }) // → '5 Bước' or '5 Steps'
 */

import { createContext, useContext, useState, useCallback } from 'react'
import vi from '../locales/vi'
import en from '../locales/en'

const LOCALES = { vi, en }
const STORAGE_KEY = 'textnow_lang'

// ── Context ──────────────────────────────────────────────────────────────────
const I18nContext = createContext(null)

// ── Provider ─────────────────────────────────────────────────────────────────
export function LanguageProvider({ children }) {
    const [lang, setLangState] = useState(
        () => localStorage.getItem(STORAGE_KEY) || 'vi'
    )

    const setLang = useCallback((code) => {
        localStorage.setItem(STORAGE_KEY, code)
        setLangState(code)
    }, [])

    return (
        <I18nContext.Provider value={{ lang, setLang }}>
            {children}
        </I18nContext.Provider>
    )
}

// ── Hook: useLanguage ─────────────────────────────────────────────────────────
export function useLanguage() {
    return useContext(I18nContext)
}

// ── Hook: useT ───────────────────────────────────────────────────────────────
/**
 * Returns a translation function t(key, vars?)
 * key: dot-separated path, e.g. 'common.save' or 'accounts.title'
 * vars: optional object for interpolation, e.g. { count: 5 }
 */
export function useT() {
    const { lang } = useContext(I18nContext)
    const locale = LOCALES[lang] || LOCALES.vi

    return useCallback((key, vars) => {
        const parts = key.split('.')
        let val = locale
        for (const p of parts) {
            val = val?.[p]
            if (val === undefined) break
        }
        // Fallback to vi if current locale missing key
        if (val === undefined) {
            val = LOCALES.vi
            for (const p of parts) {
                val = val?.[p]
                if (val === undefined) break
            }
        }
        if (typeof val !== 'string') return key
        // Interpolate {var} placeholders
        if (vars) {
            return val.replace(/\{(\w+)\}/g, (_, k) =>
                vars[k] !== undefined ? String(vars[k]) : `{${k}}`
            )
        }
        return val
    }, [lang, locale])
}

// ── Available languages ───────────────────────────────────────────────────────
export const LANGUAGES = [
    { code: 'vi', label: 'Tiếng Việt', flag: '🇻🇳' },
    { code: 'en', label: 'English', flag: '🇺🇸' },
]
