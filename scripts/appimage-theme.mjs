const forcedGtkThemeBlock = `gsettings get org.gnome.desktop.interface gtk-theme 2> /dev/null | grep -qi "dark" && GTK_THEME_VARIANT="dark" || GTK_THEME_VARIANT="light"
APPIMAGE_GTK_THEME="\${APPIMAGE_GTK_THEME:-"Adwaita:$GTK_THEME_VARIANT"}" # Allow user to override theme (discouraged)

`;

const forcedGtkThemeExport =
  'export GTK_THEME="$APPIMAGE_GTK_THEME" # Custom themes are broken\n';

const forcedX11Backend =
  "export GDK_BACKEND=x11 # Crash with Wayland backend on Wayland - We tested it without it and ended up with this: https://github.com/tauri-apps/tauri/issues/8541\n";

export function patchAppImageGtkThemeHook(source) {
  if (!source.includes(forcedGtkThemeBlock))
    throw new Error("The AppImage GTK hook theme preamble has changed.");
  if (!source.includes(forcedGtkThemeExport))
    throw new Error("The AppImage GTK hook theme export has changed.");
  if (!source.includes(forcedX11Backend))
    throw new Error("The AppImage GTK hook backend export has changed.");
  return source
    .replace(
      forcedGtkThemeBlock,
      "# Leave GTK_THEME unset so the application can switch the GTK preference at runtime.\n\n",
    )
    .replace(forcedGtkThemeExport, "")
    .replace(forcedX11Backend, "");
}

export function assertAppImageGtkThemeHook(source) {
  if (/^(?:export\s+)?GTK_THEME=/m.test(source))
    throw new Error(
      "The AppImage forces GTK_THEME and blocks runtime theme changes.",
    );
  if (/^(?:export\s+)?APPIMAGE_GTK_THEME=/m.test(source))
    throw new Error("The AppImage retains its fixed GTK theme selection.");
  if (/^export\s+GDK_BACKEND=x11/m.test(source))
    throw new Error(
      "The AppImage forces X11 instead of using the native backend.",
    );
}
