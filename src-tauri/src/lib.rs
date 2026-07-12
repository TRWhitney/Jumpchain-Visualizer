/// Starts the desktop application shell.
///
/// # Panics
///
/// Panics when Tauri cannot initialize or run the application.
pub fn run() {
    let builder = tauri::Builder::default();

    #[cfg(debug_assertions)]
    let builder = builder.plugin(tauri_plugin_wdio_webdriver::init());

    builder
        .run(tauri::generate_context!())
        .expect("failed to run Jumpchain Visualizer");
}
