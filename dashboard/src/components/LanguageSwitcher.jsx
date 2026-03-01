/**
 * LanguageSwitcher.jsx — Nút đổi ngôn ngữ VI ↔ EN
 */
import { useLanguage, LANGUAGES } from '../lib/i18n'

export default function LanguageSwitcher({ className = '' }) {
    const { lang, setLang } = useLanguage()

    return (
        <div className={`flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/8 ${className}`}>
            {LANGUAGES.map(l => (
                <button
                    key={l.code}
                    onClick={() => setLang(l.code)}
                    title={l.label}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all
                        ${lang === l.code
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                            : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                        }`}
                >
                    <span>{l.flag}</span>
                    <span className="hidden sm:inline">{l.code.toUpperCase()}</span>
                </button>
            ))}
        </div>
    )
}
