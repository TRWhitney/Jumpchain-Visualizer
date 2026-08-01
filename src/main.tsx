import { restoreDevelopmentConsoleTimeStamp } from "./platform/reactDevelopmentPerformance";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { LocalizationProvider, initializeLocalization } from "./localization";

restoreDevelopmentConsoleTimeStamp();

initializeLocalization();

const root = document.getElementById("root");

if (!root) {
  throw new Error("Application root element is missing.");
}

createRoot(root).render(
  <StrictMode>
    <LocalizationProvider>
      <App />
    </LocalizationProvider>
  </StrictMode>,
);
