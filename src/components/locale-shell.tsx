"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import { type Language } from "@/lib/i18n";

const LanguageContext = createContext<Language>("zh");

export function useLanguage() {
  return useContext(LanguageContext);
}

export function LocaleShell({ language, children }: { language: Language; children: ReactNode }) {
  useEffect(() => {
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
    window.localStorage.setItem("open-linkage:language", language);
  }, [language]);

  return (
    <LanguageContext.Provider value={language}>
      {children}
      <LanguageSwitcher language={language} />
    </LanguageContext.Provider>
  );
}

function LanguageSwitcher({ language }: { language: Language }) {
  const pathname = usePathname();
  // 语言切换只在主页提供，子页面保持当前语言。
  if (!/^\/(?:zh|en)?\/?$/.test(pathname)) return null;
  const switchTo = (nextLanguage: Language) => {
    const nextPath = pathname.replace(/^\/(?:zh|en)(?=\/|$)/, `/${nextLanguage}`);
    window.location.assign(`${nextPath}${window.location.search}${window.location.hash}`);
  };

  return (
    <div className="language-switcher" role="group" aria-label={language === "zh" ? "语言选择" : "Language selection"}>
      <button type="button" className={language === "zh" ? "active" : ""} onClick={() => switchTo("zh")} aria-pressed={language === "zh"}>中文</button>
      <button type="button" className={language === "en" ? "active" : ""} onClick={() => switchTo("en")} aria-pressed={language === "en"}>EN</button>
    </div>
  );
}
