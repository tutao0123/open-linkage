"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import { type Language } from "@/lib/i18n";

const LanguageContext = createContext<Language>("zh");

export type LanguageSwitcherProps = {
  language: Language;
  className?: string;
  variant?: "floating" | "inline";
};

export function useLanguage() {
  return useContext(LanguageContext);
}

export function LocaleShell({ language, children }: { language: Language; children: ReactNode }) {
  const pathname = usePathname();
  const isLocalizedHome = pathname === "/zh" || pathname === "/en";

  useEffect(() => {
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
    window.localStorage.setItem("open-linkage:language", language);
  }, [language]);

  return (
    <LanguageContext.Provider value={language}>
      {children}
      {isLocalizedHome ? null : <LanguageSwitcher language={language} />}
    </LanguageContext.Provider>
  );
}

export function LanguageSwitcher({
  language,
  className,
  variant = "floating",
}: LanguageSwitcherProps) {
  const pathname = usePathname();
  const switchTo = (nextLanguage: Language) => {
    const nextPath = pathname.replace(/^\/(?:zh|en)(?=\/|$)/, `/${nextLanguage}`);
    window.location.assign(`${nextPath}${window.location.search}${window.location.hash}`);
  };

  const rootClassName = ["language-switcher", className].filter(Boolean).join(" ");

  return (
    <div
      className={rootClassName}
      role="group"
      aria-label={language === "zh" ? "语言选择" : "Language selection"}
      data-language-switcher={variant}
      data-current-language={language}
    >
      <button
        type="button"
        className={language === "zh" ? "active" : ""}
        onClick={() => switchTo("zh")}
        aria-pressed={language === "zh"}
        data-language-option="zh"
      >
        中文
      </button>
      <button
        type="button"
        className={language === "en" ? "active" : ""}
        onClick={() => switchTo("en")}
        aria-pressed={language === "en"}
        data-language-option="en"
      >
        EN
      </button>
    </div>
  );
}
