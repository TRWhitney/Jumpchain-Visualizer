use std::io::Cursor;

use archive_core::{EffectivePackageSizeLimits, inspect_archive};
use tauri_plugin_dialog::DialogExt;

use crate::{
    atomic_write,
    command::{CommandError, CommandResult},
    validation::sanitize_suggested_name,
};

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
pub(crate) fn save_diagnostic_report(
    app: tauri::AppHandle,
    suggested_name: String,
    content: String,
) -> CommandResult<&'static str> {
    if content.len() > 4 * 1024 * 1024 {
        return Err(CommandError::from(
            "diagnostic report exceeds the application limit",
        ));
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

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
pub(crate) fn save_editor_package(
    app: tauri::AppHandle,
    suggested_name: String,
    bytes: Vec<u8>,
    limits: EffectivePackageSizeLimits,
) -> CommandResult<&'static str> {
    inspect_archive(Cursor::new(&bytes), limits).map_err(|error| error.to_string())?;
    let safe_name = sanitize_suggested_name(&suggested_name);
    let selected = app
        .dialog()
        .file()
        .set_file_name(if safe_name.is_empty() {
            "jump-package.jmp"
        } else {
            &safe_name
        })
        .blocking_save_file();
    let Some(selected) = selected else {
        return Ok("cancelled");
    };
    let path = selected
        .into_path()
        .map_err(|_| "the selected package destination is not a local path")?;
    atomic_write(&path, &bytes)?;
    Ok("saved")
}
