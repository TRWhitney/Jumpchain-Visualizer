import { useEffect, useState, type ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import i18next from "i18next";
import { initializeLocalization } from "./catalog";

export function LocalizationProvider({ children }: { children: ReactNode }) {
  const [, setRevision] = useState(0);
  initializeLocalization();
  useEffect(() => {
    const changed = () => setRevision((value) => value + 1);
    i18next.on("languageChanged", changed);
    return () => {
      i18next.off("languageChanged", changed);
    };
  }, []);
  return <I18nextProvider i18n={i18next}>{children}</I18nextProvider>;
}
