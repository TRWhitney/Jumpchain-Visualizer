export function ThemeIcon({ theme }: { theme: "light" | "dark" }) {
  return (
    <svg aria-hidden="true" data-theme-icon={theme} viewBox="0 0 24 24">
      {theme === "light" ? (
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41" />
        </>
      ) : (
        <path d="M20.25 15.32A8.5 8.5 0 0 1 8.68 3.75a8.5 8.5 0 1 0 11.57 11.57Z" />
      )}
    </svg>
  );
}
