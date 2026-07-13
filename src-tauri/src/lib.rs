use std::sync::Mutex;

use persistence::AggregateStore;
use tauri::{Manager, State};
use tauri_plugin_dialog::DialogExt;

struct PersistenceState(Mutex<AggregateStore>);

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn load_settings(state: State<'_, PersistenceState>) -> Result<Option<serde_json::Value>, String> {
    let store = state
        .0
        .lock()
        .map_err(|_| "settings database lock failed")?;
    let payload = store.load("settings").map_err(|_| "settings read failed")?;
    payload
        .map(|value| {
            serde_json::from_str(&value).map_err(|_| "stored settings are invalid JSON".to_owned())
        })
        .transpose()
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn save_settings(payload: String, state: State<'_, PersistenceState>) -> Result<(), String> {
    validate_settings_payload(&payload)?;
    state
        .0
        .lock()
        .map_err(|_| "settings database lock failed")?
        .save("settings", 1, &payload)
        .map_err(|_| "settings write failed".to_owned())
}

fn validate_settings_payload(payload: &str) -> Result<(), String> {
    if payload.len() > 2 * 1024 * 1024 {
        return Err("settings payload exceeds the application limit".to_owned());
    }
    let value: serde_json::Value =
        serde_json::from_str(payload).map_err(|_| "settings payload is invalid JSON")?;
    if value
        .get("schemaVersion")
        .and_then(serde_json::Value::as_u64)
        != Some(1)
    {
        return Err("settings schema version is unsupported".to_owned());
    }
    Ok(())
}

fn sanitize_suggested_name(suggested_name: &str) -> String {
    suggested_name
        .chars()
        .filter(|character| {
            character.is_ascii_alphanumeric() || ['-', '_', '.'].contains(character)
        })
        .take(100)
        .collect()
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn save_diagnostic_report(
    app: tauri::AppHandle,
    suggested_name: String,
    content: String,
) -> Result<&'static str, String> {
    if content.len() > 4 * 1024 * 1024 {
        return Err("diagnostic report exceeds the application limit".to_owned());
    }
    let safe_name = sanitize_suggested_name(&suggested_name);
    let selected = app
        .dialog()
        .file()
        .set_file_name(if safe_name.is_empty() {
            "jumpchain-visualizer-report.txt"
        } else {
            &safe_name
        })
        .blocking_save_file();
    let Some(selected) = selected else {
        return Ok("cancelled");
    };
    let path = selected
        .into_path()
        .map_err(|_| "the selected report destination is not a local path")?;
    std::fs::write(path, content).map_err(|_| "diagnostic report write failed")?;
    Ok("saved")
}

/// Starts the desktop application shell.
///
/// # Panics
///
/// Panics when Tauri cannot initialize or run the application.
pub fn run() {
    let builder = tauri::Builder::default().plugin(tauri_plugin_dialog::init());

    #[cfg(debug_assertions)]
    let builder = builder.plugin(tauri_plugin_wdio_webdriver::init());

    builder
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;
            let store = AggregateStore::open(data_dir.join("jumpchain-visualizer.sqlite"))?;
            app.manage(PersistenceState(Mutex::new(store)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            load_settings,
            save_settings,
            save_diagnostic_report
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Jumpchain Visualizer");
}

#[cfg(test)]
mod tests {
    use super::{sanitize_suggested_name, validate_settings_payload};

    #[test]
    fn rejects_invalid_or_unsupported_settings_payloads() {
        assert!(validate_settings_payload("not-json").is_err());
        assert!(validate_settings_payload(r#"{"schemaVersion":2}"#).is_err());
        assert!(validate_settings_payload(r#"{"schemaVersion":1}"#).is_ok());
    }

    #[test]
    fn bounds_report_names_to_local_safe_characters() {
        assert_eq!(
            sanitize_suggested_name("../private/report name.txt"),
            "..privatereportname.txt"
        );
        assert_eq!(sanitize_suggested_name(&"a".repeat(120)).len(), 100);
    }
}
