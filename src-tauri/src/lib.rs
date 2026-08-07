use std::{
    collections::HashSet,
    io::Cursor,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

use archive_core::{EffectivePackageSizeLimits, inspect_archive, validate_image};
use command::{CommandError, CommandResult, PersistenceState};
use export_commands::{save_diagnostic_report, save_editor_package};
use persistence::AggregateStore;
use platform_commands::{sample_screen_color, screen_color_sampler_available};
use tauri::{Manager, State};
use tauri_plugin_dialog::DialogExt;
use validation::{
    safe_workspace_id, validate_chain_payload, validate_settings_payload,
    validate_welcome_tour_payload,
};

mod command;
mod export_commands;
mod platform_commands;
mod validation;

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn load_settings(state: State<'_, PersistenceState>) -> CommandResult<Option<serde_json::Value>> {
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
        .map_err(Into::into)
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn save_settings(payload: String, state: State<'_, PersistenceState>) -> CommandResult<()> {
    validate_settings_payload(&payload)?;
    state
        .0
        .lock()
        .map_err(|_| "settings database lock failed")?
        .save("settings", 1, &payload)
        .map_err(|_| CommandError::from("settings write failed"))
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn load_welcome_tour_session(
    state: State<'_, PersistenceState>,
) -> CommandResult<Option<serde_json::Value>> {
    let store = state
        .0
        .lock()
        .map_err(|_| "welcome tour database lock failed")?;
    store
        .load("welcome-tour")
        .map_err(|_| "welcome tour read failed")?
        .map(|payload| {
            validate_welcome_tour_payload(&payload)?;
            serde_json::from_str(&payload)
                .map_err(|_| "welcome tour payload is invalid JSON".to_owned())
        })
        .transpose()
        .map_err(Into::into)
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn save_welcome_tour_session(
    payload: String,
    state: State<'_, PersistenceState>,
) -> CommandResult<()> {
    validate_welcome_tour_payload(&payload)?;
    state
        .0
        .lock()
        .map_err(|_| "welcome tour database lock failed")?
        .save("welcome-tour", 1, &payload)
        .map_err(|_| CommandError::from("welcome tour write failed"))
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn clear_welcome_tour_session(state: State<'_, PersistenceState>) -> CommandResult<()> {
    state
        .0
        .lock()
        .map_err(|_| "welcome tour database lock failed")?
        .remove("welcome-tour")
        .map_err(|_| CommandError::from("welcome tour clear failed"))
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn load_chains(state: State<'_, PersistenceState>) -> CommandResult<Vec<serde_json::Value>> {
    let store = state.0.lock().map_err(|_| "chain database lock failed")?;
    let payload = store.load("chains").map_err(|_| "chain read failed")?;
    payload
        .map(|value| {
            serde_json::from_str(&value).map_err(|_| "stored chains are invalid JSON".to_owned())
        })
        .transpose()
        .map(Option::unwrap_or_default)
        .map_err(Into::into)
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn chains_initialized(state: State<'_, PersistenceState>) -> CommandResult<bool> {
    state
        .0
        .lock()
        .map_err(|_| "chain database lock failed")?
        .load("chains")
        .map(|value| value.is_some())
        .map_err(|_| CommandError::from("chain read failed"))
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn save_chain(payload: String, state: State<'_, PersistenceState>) -> CommandResult<()> {
    let value = validate_chain_payload(&payload)?;
    let mut store = state.0.lock().map_err(|_| "chain database lock failed")?;
    let existing = store.load("chains").map_err(|_| "chain read failed")?;
    let mut chains: Vec<serde_json::Value> = existing
        .map(|current| {
            serde_json::from_str(&current).map_err(|_| "stored chains are invalid JSON".to_owned())
        })
        .transpose()?
        .unwrap_or_default();
    let id = value
        .get("id")
        .and_then(serde_json::Value::as_str)
        .ok_or("chain id is missing")?;
    if let Some(index) = chains
        .iter()
        .position(|item| item.get("id").and_then(serde_json::Value::as_str) == Some(id))
    {
        chains[index] = value;
    } else {
        chains.push(value);
    }
    let encoded = serde_json::to_string(&chains).map_err(|_| "chain serialization failed")?;
    store
        .save("chains", 1, &encoded)
        .map_err(|_| CommandError::from("chain write failed"))
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn remove_chain(id: String, state: State<'_, PersistenceState>) -> CommandResult<()> {
    let mut store = state.0.lock().map_err(|_| "chain database lock failed")?;
    let existing = store.load("chains").map_err(|_| "chain read failed")?;
    let mut chains: Vec<serde_json::Value> = existing
        .map(|current| {
            serde_json::from_str(&current).map_err(|_| "stored chains are invalid JSON".to_owned())
        })
        .transpose()?
        .unwrap_or_default();
    chains.retain(|item| item.get("id").and_then(serde_json::Value::as_str) != Some(&id));
    let encoded = serde_json::to_string(&chains).map_err(|_| "chain serialization failed")?;
    store
        .save("chains", 1, &encoded)
        .map_err(|_| CommandError::from("chain write failed"))
}

#[derive(serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct ChainPackageMetadata {
    chain_id: String,
    id: String,
    limits: EffectivePackageSizeLimits,
}

fn chain_package_directory(app: &tauri::AppHandle, chain_id: &str) -> Result<PathBuf, String> {
    if !safe_workspace_id(chain_id) {
        return Err("Chain package chain id is invalid".to_owned());
    }
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|_| "Application package path is unavailable")?
        .join("chain-packages")
        .join(chain_id))
}

fn validate_chain_package_metadata(metadata: &ChainPackageMetadata) -> Result<(), String> {
    if !safe_workspace_id(&metadata.chain_id) || !safe_workspace_id(&metadata.id) {
        return Err("Chain package identity is invalid".to_owned());
    }
    metadata
        .limits
        .validate()
        .map(|_| ())
        .map_err(|_| "Chain package limits are invalid".to_owned())
}

fn read_chain_package_metadata(path: &Path) -> Result<ChainPackageMetadata, String> {
    let bytes = std::fs::read(path).map_err(|_| "Chain package metadata could not be read")?;
    if bytes.len() > 16 * 1024 {
        return Err("Chain package metadata is too large".to_owned());
    }
    let metadata: ChainPackageMetadata =
        serde_json::from_slice(&bytes).map_err(|_| "Chain package metadata is invalid JSON")?;
    validate_chain_package_metadata(&metadata)?;
    Ok(metadata)
}

fn decode_chain_package_payload(payload: &[u8]) -> Result<(ChainPackageMetadata, &[u8]), String> {
    let header_length = payload
        .get(..4)
        .and_then(|bytes| <[u8; 4]>::try_from(bytes).ok())
        .map(u32::from_le_bytes)
        .map(|length| length as usize)
        .ok_or("Chain package header is missing")?;
    if header_length == 0 || header_length > 16 * 1024 || payload.len() < 4 + header_length {
        return Err("Chain package header is invalid".to_owned());
    }
    let metadata: ChainPackageMetadata = serde_json::from_slice(&payload[4..4 + header_length])
        .map_err(|_| "Chain package header is invalid JSON".to_owned())?;
    validate_chain_package_metadata(&metadata)?;
    Ok((metadata, &payload[4 + header_length..]))
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn save_chain_package(
    app: tauri::AppHandle,
    request: tauri::ipc::Request<'_>,
) -> CommandResult<()> {
    let tauri::ipc::InvokeBody::Raw(payload) = request.body() else {
        return Err(CommandError::from("Chain package payload is not binary"));
    };
    let (metadata, archive) = decode_chain_package_payload(payload)?;
    inspect_archive(Cursor::new(archive), metadata.limits)
        .map_err(|_| CommandError::from("Chain package archive is invalid"))?;

    let directory = chain_package_directory(&app, &metadata.chain_id)?;
    std::fs::create_dir_all(&directory)
        .map_err(|_| CommandError::from("Chain package directory could not be created"))?;
    atomic_write(&directory.join(format!("{}.jmp", metadata.id)), archive)?;
    let encoded = serde_json::to_vec(&metadata)
        .map_err(|_| CommandError::from("Chain package metadata encoding failed"))?;
    atomic_write(&directory.join(format!("{}.json", metadata.id)), &encoded)?;
    Ok(())
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn list_chain_packages(
    app: tauri::AppHandle,
    chain_id: String,
) -> CommandResult<Vec<ChainPackageMetadata>> {
    let directory = chain_package_directory(&app, &chain_id)?;
    if !directory.exists() {
        return Ok(Vec::new());
    }
    let entries = std::fs::read_dir(&directory)
        .map_err(|_| CommandError::from("Chain package directory could not be read"))?;
    let mut metadata = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|value| value.to_str()) != Some("json") {
            continue;
        }
        let Ok(item) = read_chain_package_metadata(&path) else {
            continue;
        };
        if item.chain_id == chain_id && directory.join(format!("{}.jmp", item.id)).is_file() {
            metadata.push(item);
        }
    }
    Ok(metadata)
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn load_chain_package(
    app: tauri::AppHandle,
    chain_id: String,
    id: String,
) -> CommandResult<tauri::ipc::Response> {
    if !safe_workspace_id(&id) {
        return Err(CommandError::from("Chain package id is invalid"));
    }
    let directory = chain_package_directory(&app, &chain_id)?;
    let metadata = read_chain_package_metadata(&directory.join(format!("{id}.json")))?;
    if metadata.chain_id != chain_id || metadata.id != id {
        return Err(CommandError::from("Chain package metadata does not match"));
    }
    let archive = std::fs::read(directory.join(format!("{id}.jmp")))
        .map_err(|_| CommandError::from("Chain package archive could not be read"))?;
    inspect_archive(Cursor::new(&archive), metadata.limits)
        .map_err(|_| CommandError::from("Stored chain package archive is invalid"))?;
    Ok(tauri::ipc::Response::new(archive))
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn remove_chain_package(app: tauri::AppHandle, chain_id: String, id: String) -> CommandResult<()> {
    if !safe_workspace_id(&id) {
        return Err(CommandError::from("Chain package id is invalid"));
    }
    let directory = chain_package_directory(&app, &chain_id)?;
    for extension in ["json", "jmp"] {
        let path = directory.join(format!("{id}.{extension}"));
        if path.exists() {
            std::fs::remove_file(path)
                .map_err(|_| CommandError::from("Chain package could not be removed"))?;
        }
    }
    Ok(())
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn remove_chain_packages(app: tauri::AppHandle, chain_id: String) -> CommandResult<()> {
    let directory = chain_package_directory(&app, &chain_id)?;
    if !directory.exists() {
        return Ok(());
    }
    for entry in std::fs::read_dir(&directory)
        .map_err(|_| CommandError::from("Chain package directory could not be read"))?
        .flatten()
    {
        let path = entry.path();
        if path.is_file() {
            std::fs::remove_file(path)
                .map_err(|_| CommandError::from("Chain package could not be removed"))?;
        }
    }
    std::fs::remove_dir(&directory)
        .map_err(|_| CommandError::from("Chain package directory could not be removed"))?;
    Ok(())
}

fn editor_workspace_values(store: &AggregateStore) -> Result<Vec<serde_json::Value>, String> {
    store
        .load("editor-workspaces")
        .map_err(|_| "Editor registry read failed".to_owned())?
        .map(|value| {
            serde_json::from_str(&value)
                .map_err(|_| "stored Editor registry is invalid JSON".to_owned())
        })
        .transpose()
        .map(Option::unwrap_or_default)
}

fn validate_editor_workspace_payload(payload: &str) -> Result<serde_json::Value, String> {
    if payload.len() > 128 * 1024 * 1024 {
        return Err("Editor recovery payload exceeds the application limit".to_owned());
    }
    let value: serde_json::Value =
        serde_json::from_str(payload).map_err(|_| "Editor payload is invalid JSON")?;
    if value
        .get("schemaVersion")
        .and_then(serde_json::Value::as_u64)
        != Some(1)
    {
        return Err("Editor schema version is unsupported".to_owned());
    }
    if !value
        .get("id")
        .and_then(serde_json::Value::as_str)
        .is_some_and(safe_workspace_id)
    {
        return Err("Editor workspace id is invalid".to_owned());
    }
    if !value.get("files").is_some_and(serde_json::Value::is_object) {
        return Err("Editor source files are missing".to_owned());
    }
    Ok(value)
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn list_editor_workspaces(
    state: State<'_, PersistenceState>,
) -> CommandResult<Vec<serde_json::Value>> {
    let store = state.0.lock().map_err(|_| "Editor registry lock failed")?;
    editor_workspace_values(&store).map_err(Into::into)
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn load_editor_workspace(
    id: String,
    state: State<'_, PersistenceState>,
) -> CommandResult<Option<serde_json::Value>> {
    let store = state.0.lock().map_err(|_| "Editor registry lock failed")?;
    Ok(editor_workspace_values(&store)?
        .into_iter()
        .find(|workspace| {
            workspace.get("id").and_then(serde_json::Value::as_str) == Some(id.as_str())
        }))
}

pub(crate) fn atomic_write(path: &Path, content: &[u8]) -> Result<(), String> {
    let name = path
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or("project file name is invalid")?;
    let temporary = path.with_file_name(format!(".{name}.jumpchain-tmp-{}", std::process::id()));
    std::fs::write(&temporary, content).map_err(|_| "temporary project write failed")?;
    std::fs::rename(&temporary, path).map_err(|_| {
        let _ = std::fs::remove_file(&temporary);
        "atomic project replacement failed".to_owned()
    })
}

fn save_external_workspace(value: &serde_json::Value) -> Result<(), String> {
    if value.get("location").and_then(serde_json::Value::as_str) != Some("desktop") {
        return Ok(());
    }
    let folder = value
        .get("externalFolder")
        .and_then(serde_json::Value::as_str)
        .ok_or("desktop project folder is missing")?;
    let root = PathBuf::from(folder)
        .canonicalize()
        .map_err(|_| "desktop project folder is unavailable")?;
    if !root.is_dir() {
        return Err("desktop project folder is unavailable".to_owned());
    }
    let files = value
        .get("files")
        .and_then(serde_json::Value::as_object)
        .ok_or("Editor source files are missing")?;
    for (name, source) in files {
        if name.contains('/')
            || name.contains('\\')
            || !name.to_ascii_lowercase().ends_with(".jdef")
        {
            return Err("desktop project contains an invalid source path".to_owned());
        }
        let source = source.as_str().ok_or("Editor source is not text")?;
        atomic_write(&root.join(name), source.as_bytes())?;
    }
    // Asset bytes are a local editor copy. They are deliberately retained in
    // recovery storage and flattened package export, never written back over a
    // desktop folder that supplied the original files.
    value
        .get("assets")
        .and_then(serde_json::Value::as_object)
        .ok_or("Editor assets are missing")?;
    Ok(())
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn save_editor_workspace(
    app: tauri::AppHandle,
    payload: String,
    state: State<'_, PersistenceState>,
) -> CommandResult<()> {
    persist_editor_workspace_payload(&app, &payload, &state)
}

fn persist_editor_workspace_payload(
    app: &tauri::AppHandle,
    payload: &str,
    state: &PersistenceState,
) -> CommandResult<()> {
    let value = validate_editor_workspace_payload(payload)?;
    save_external_workspace(&value)?;
    let id = value
        .get("id")
        .and_then(serde_json::Value::as_str)
        .ok_or("Editor workspace id is missing")?;
    let recovery_dir = app
        .path()
        .app_data_dir()
        .map_err(|_| "application recovery path is unavailable")?
        .join("editor-recovery");
    std::fs::create_dir_all(&recovery_dir)
        .map_err(|_| "Editor recovery directory could not be created")?;
    atomic_write(&recovery_dir.join(format!("{id}.json")), payload.as_bytes())?;

    let mut store = state.0.lock().map_err(|_| "Editor registry lock failed")?;
    let mut workspaces = editor_workspace_values(&store)?;
    if let Some(index) = workspaces
        .iter()
        .position(|workspace| workspace.get("id").and_then(serde_json::Value::as_str) == Some(id))
    {
        workspaces[index] = value;
    } else {
        workspaces.push(value);
    }
    let encoded =
        serde_json::to_string(&workspaces).map_err(|_| "Editor registry encoding failed")?;
    store
        .save("editor-workspaces", 1, &encoded)
        .map_err(|_| CommandError::from("Editor registry write failed"))
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn save_editor_workspace_binary(
    app: tauri::AppHandle,
    request: tauri::ipc::Request<'_>,
    state: State<'_, PersistenceState>,
) -> CommandResult<()> {
    let tauri::ipc::InvokeBody::Raw(payload) = request.body() else {
        return Err(CommandError::from("Editor payload is not binary"));
    };
    let payload = std::str::from_utf8(payload)
        .map_err(|_| CommandError::from("Editor payload is invalid JSON"))?;
    persist_editor_workspace_payload(&app, payload, &state)
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn remove_editor_workspace(
    app: tauri::AppHandle,
    id: String,
    state: State<'_, PersistenceState>,
) -> CommandResult<()> {
    if !safe_workspace_id(&id) {
        return Err(CommandError::from("Editor workspace id is invalid"));
    }
    let mut store = state.0.lock().map_err(|_| "Editor registry lock failed")?;
    let mut workspaces = editor_workspace_values(&store)?;
    workspaces.retain(|workspace| {
        workspace.get("id").and_then(serde_json::Value::as_str) != Some(id.as_str())
    });
    let encoded =
        serde_json::to_string(&workspaces).map_err(|_| "Editor registry encoding failed")?;
    let recovery = app
        .path()
        .app_data_dir()
        .map_err(|_| "application recovery path is unavailable")?
        .join("editor-recovery")
        .join(format!("{id}.json"));
    let staged_recovery = recovery.with_extension("json.jumpchain-delete");
    let staged = match std::fs::rename(&recovery, &staged_recovery) {
        Ok(()) => true,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => false,
        Err(_) => {
            return Err(CommandError::from(
                "Editor recovery data could not be staged for removal",
            ));
        }
    };
    if let Err(error) = store
        .save("editor-workspaces", 1, &encoded)
        .map_err(|_| "Editor registry write failed".to_owned())
    {
        if staged {
            let _ = std::fs::rename(&staged_recovery, &recovery);
        }
        return Err(error.into());
    }
    drop(store);
    if staged {
        std::fs::remove_file(staged_recovery)
            .map_err(|_| "Editor recovery data could not be removed".to_owned())?;
    }
    Ok(())
}

fn safe_project_entry(path: &Path, root: &Path) -> Result<String, String> {
    let relative = path
        .strip_prefix(root)
        .map_err(|_| "project entry escapes its root")?;
    let parts: Vec<_> = relative
        .components()
        .map(|part| part.as_os_str().to_string_lossy().into_owned())
        .collect();
    if parts
        .iter()
        .any(|part| part.is_empty() || part == "." || part == "..")
    {
        return Err("project entry path is invalid".to_owned());
    }
    Ok(parts.join("/"))
}

type ProjectFolderContents = (
    serde_json::Map<String, serde_json::Value>,
    serde_json::Map<String, serde_json::Value>,
);

fn read_project_folder(
    root: &Path,
    limits: EffectivePackageSizeLimits,
) -> Result<ProjectFolderContents, String> {
    let limits = limits.validate().map_err(|error| error.to_string())?;
    let mut files = serde_json::Map::new();
    let mut assets = serde_json::Map::new();
    let mut entries = Vec::new();
    for item in std::fs::read_dir(root).map_err(|_| "project folder cannot be read")? {
        let item = item.map_err(|_| "project folder contains an unreadable entry")?;
        let file_type = item
            .file_type()
            .map_err(|_| "project entry type cannot be read")?;
        if file_type.is_symlink() {
            return Err("project folders cannot contain symbolic links".to_owned());
        }
        if file_type.is_file() {
            entries.push(item.path());
        } else if file_type.is_dir() && item.file_name() == "assets" {
            for asset in
                std::fs::read_dir(item.path()).map_err(|_| "project assets cannot be read")?
            {
                let asset = asset.map_err(|_| "project asset cannot be read")?;
                if !asset
                    .file_type()
                    .map_err(|_| "project asset type cannot be read")?
                    .is_file()
                {
                    return Err("project assets cannot contain links or directories".to_owned());
                }
                entries.push(asset.path());
            }
        } else {
            return Err("project folder contains an unexpected entry".to_owned());
        }
    }
    if entries.is_empty() || entries.len() > 256 {
        return Err("project folder entry count is invalid".to_owned());
    }
    let mut total = 0_u64;
    let mut total_image_pixels = 0_u64;
    let mut collisions = HashSet::new();
    for path in entries {
        let relative = safe_project_entry(&path, root)?;
        if !collisions.insert(relative.to_lowercase()) {
            return Err("project folder contains colliding paths".to_owned());
        }
        let bytes = std::fs::read(&path).map_err(|_| "project entry cannot be read")?;
        total = total.saturating_add(bytes.len() as u64);
        if total > limits.max_expanded_package_mi_b * 1024 * 1024 {
            return Err("project folder exceeds the expanded package limit".to_owned());
        }
        if Path::new(&relative)
            .extension()
            .is_some_and(|extension| extension.eq_ignore_ascii_case("jdef"))
            && !relative.contains('/')
        {
            if bytes.len() as u64 > limits.max_definition_file_mi_b * 1024 * 1024 {
                return Err("project definition exceeds its effective limit".to_owned());
            }
            let source =
                String::from_utf8(bytes).map_err(|_| "project definition is not valid UTF-8")?;
            files.insert(relative, serde_json::Value::String(source));
        } else if relative.starts_with("assets/")
            && ["png", "jpg", "jpeg", "gif", "webp", "avif"]
                .iter()
                .any(|extension| {
                    relative
                        .to_ascii_lowercase()
                        .ends_with(&format!(".{extension}"))
                })
        {
            if bytes.len() as u64 > limits.max_asset_file_mi_b * 1024 * 1024 {
                return Err("project asset exceeds its effective limit".to_owned());
            }
            let (width, height) =
                validate_image(&relative, &bytes).map_err(|error| error.to_string())?;
            total_image_pixels = total_image_pixels.saturating_add(width.saturating_mul(height));
            if total_image_pixels > 64_000_000 {
                return Err("project images exceed the mandatory pixel limit".to_owned());
            }
            assets.insert(relative, serde_json::json!(bytes));
        } else {
            return Err("project folder contains an unsupported file".to_owned());
        }
    }
    if !files.contains_key("jump.jdef") {
        return Err("project folder is missing jump.jdef".to_owned());
    }
    Ok((files, assets))
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn open_editor_project_folder(
    app: tauri::AppHandle,
    limits: EffectivePackageSizeLimits,
) -> CommandResult<Option<serde_json::Value>> {
    let selected = app.dialog().file().blocking_pick_folder();
    let Some(selected) = selected else {
        return Ok(None);
    };
    let root = selected
        .into_path()
        .map_err(|_| "the selected project is not a local folder")?
        .canonicalize()
        .map_err(|_| "the selected project folder is unavailable")?;
    let (files, assets) = read_project_folder(&root, limits)?;
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|_| "system time is unavailable")?
        .as_nanos();
    let now = stamp / 1_000_000;
    Ok(Some(serde_json::json!({
        "schemaVersion": 1,
        "id": format!("desktop-{stamp:x}-{:x}", std::process::id()),
        "location": "desktop",
        "externalFolder": root,
        "files": files,
        "assets": assets,
        "starred": false,
        "createdAt": format!("{now}"),
        "updatedAt": format!("{now}"),
        "lastOpenedAt": format!("{now}"),
        "revision": 0
    })))
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn scan_editor_project_folder(
    folder: String,
    limits: EffectivePackageSizeLimits,
) -> CommandResult<serde_json::Value> {
    let root = PathBuf::from(folder)
        .canonicalize()
        .map_err(|_| "desktop project folder is unavailable")?;
    if !root.is_dir() {
        return Err(CommandError::from("desktop project folder is unavailable"));
    }
    let (files, assets) = read_project_folder(&root, limits)?;
    Ok(serde_json::json!({ "files": files, "assets": assets }))
}

/// Starts the desktop application shell.
///
/// # Panics
///
/// Panics when Tauri cannot initialize or run the application.
pub fn run() {
    let builder = tauri::Builder::default().plugin(tauri_plugin_dialog::init());

    #[cfg(any(debug_assertions, feature = "native-test"))]
    let builder = builder.plugin(tauri_plugin_wdio_webdriver::init());

    builder
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;
            let store = AggregateStore::open(data_dir.join("jumpchain-visualizer.sqlite"))?;
            app.manage(PersistenceState(std::sync::Mutex::new(store)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            load_settings,
            save_settings,
            load_welcome_tour_session,
            save_welcome_tour_session,
            clear_welcome_tour_session,
            load_chains,
            chains_initialized,
            save_chain,
            remove_chain,
            save_chain_package,
            list_chain_packages,
            load_chain_package,
            remove_chain_package,
            remove_chain_packages,
            list_editor_workspaces,
            load_editor_workspace,
            save_editor_workspace,
            save_editor_workspace_binary,
            remove_editor_workspace,
            open_editor_project_folder,
            scan_editor_project_folder,
            screen_color_sampler_available,
            sample_screen_color,
            save_diagnostic_report,
            save_editor_package
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Jumpchain Visualizer");
}

#[cfg(test)]
mod tests {
    use std::{
        path::PathBuf,
        time::{SystemTime, UNIX_EPOCH},
    };

    use super::{
        CommandError, EffectivePackageSizeLimits, atomic_write, decode_chain_package_payload,
        read_project_folder, save_external_workspace,
    };
    use crate::validation::{
        safe_workspace_id, sanitize_suggested_name, validate_chain_payload,
        validate_settings_payload, validate_welcome_tour_payload,
    };

    #[cfg(target_os = "linux")]
    use crate::platform_commands::portal_color_to_hex;

    fn limits() -> EffectivePackageSizeLimits {
        EffectivePackageSizeLimits {
            max_archive_mi_b: 64,
            max_definition_file_mi_b: 2,
            max_asset_file_mi_b: 16,
            max_expanded_package_mi_b: 96,
        }
    }

    #[test]
    fn command_errors_are_structured_codes_without_display_copy() {
        let encoded = serde_json::to_value(CommandError::from("settings read failed"))
            .expect("command error serializes");
        assert_eq!(encoded["code"], "SETTINGS_READ_FAILED");
        assert_eq!(encoded["parameters"], serde_json::json!({}));
        assert!(encoded.get("message").is_none());
    }

    fn temporary_folder(label: &str) -> PathBuf {
        std::env::temp_dir().join(format!(
            "jumpchain-visualizer-{label}-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("clock")
                .as_nanos()
        ))
    }

    #[test]
    fn rejects_invalid_or_unsupported_settings_payloads() {
        assert!(validate_settings_payload("not-json").is_err());
        assert!(validate_settings_payload(r#"{"schemaVersion":1}"#).is_err());
        assert!(validate_settings_payload(r#"{"schemaVersion":2}"#).is_err());
        assert!(validate_settings_payload(r#"{"schemaVersion":5}"#).is_ok());
    }

    #[test]
    fn validates_bounded_welcome_tour_payloads() {
        let valid = r#"{
          "schemaVersion":1,
          "stepId":"welcome",
          "editorWorkspace":{
            "id":"welcome-tour-editor",
            "files":{"jump.jdef":"","choices.jdef":"","layout.jdef":""}
          },
          "trackerState":{"packages":{
            "system-earth":{},
            "welcome-tour-trailhead":{},
            "welcome-tour-crossroads":{}
          }}
        }"#;
        assert!(validate_welcome_tour_payload("not-json").is_err());
        assert!(validate_welcome_tour_payload(valid).is_ok());
        assert!(
            validate_welcome_tour_payload(r#"{"schemaVersion":2,"stepId":"welcome"}"#).is_err()
        );
        assert!(validate_welcome_tour_payload(r#"{"schemaVersion":1,"stepId":""}"#).is_err());
        assert!(validate_welcome_tour_payload(&valid.replace("welcome", "unknown-step")).is_err());
        assert!(
            validate_welcome_tour_payload(&valid.replace("welcome-tour-editor", "ordinary-editor"))
                .is_err()
        );
    }

    #[test]
    fn bounds_report_names_to_local_safe_characters() {
        assert_eq!(
            sanitize_suggested_name("../private/report name.txt"),
            "..privatereportname.txt"
        );
        assert_eq!(sanitize_suggested_name(&"a".repeat(120)).len(), 100);
    }

    #[test]
    fn bounds_editor_recovery_ids_to_local_safe_characters() {
        assert!(safe_workspace_id("desktop-1234_abcd"));
        assert!(!safe_workspace_id("../editor-recovery"));
        assert!(!safe_workspace_id("folder/project"));
        assert!(!safe_workspace_id(""));
    }

    #[test]
    fn validates_bounded_binary_chain_package_headers() {
        let metadata = serde_json::json!({
            "chainId": "chain-1",
            "id": "imported-abcd",
            "limits": limits(),
        });
        let header = serde_json::to_vec(&metadata).expect("encode package header");
        let header_length = u32::try_from(header.len()).expect("bounded package header length");
        let mut payload = Vec::from(header_length.to_le_bytes());
        payload.extend_from_slice(&header);
        payload.extend_from_slice(b"archive");
        let (decoded, archive) =
            decode_chain_package_payload(&payload).expect("decode package payload");
        assert_eq!(decoded.chain_id, "chain-1");
        assert_eq!(archive, b"archive");

        payload[0..4].copy_from_slice(&(20_000_u32).to_le_bytes());
        assert!(decode_chain_package_payload(&payload).is_err());
    }

    #[test]
    fn validates_versioned_chain_payloads() {
        assert!(validate_chain_payload(r#"{"schemaVersion":3,"id":"chain-1"}"#).is_ok());
        assert!(validate_chain_payload(r#"{"schemaVersion":2,"id":"chain-1"}"#).is_err());
        assert!(validate_chain_payload(r#"{"schemaVersion":1,"id":"chain-1"}"#).is_err());
        assert!(validate_chain_payload(r#"{"schemaVersion":3,"id":""}"#).is_err());
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn converts_only_bounded_portal_colors_to_canonical_hex() {
        assert_eq!(
            portal_color_to_hex(0.0, 0.5, 1.0).expect("valid portal color"),
            "#0080FF"
        );
        assert!(portal_color_to_hex(-0.1, 0.5, 1.0).is_err());
        assert!(portal_color_to_hex(f64::NAN, 0.5, 1.0).is_err());
    }

    #[test]
    fn reads_only_bounded_desktop_project_entries() {
        let folder = temporary_folder("folder-read");
        std::fs::create_dir_all(&folder).expect("create fixture folder");
        std::fs::write(folder.join("jump.jdef"), "jump\n  format: 1\n")
            .expect("write fixture source");
        let (files, assets) = read_project_folder(&folder, limits()).expect("read project");
        assert!(files.contains_key("jump.jdef"));
        assert!(assets.is_empty());
        std::fs::write(folder.join("payload.html"), "unsafe").expect("write attack file");
        assert!(read_project_folder(&folder, limits()).is_err());
        std::fs::remove_dir_all(&folder).expect("remove fixture folder");
    }

    #[test]
    fn atomic_write_replaces_complete_content_without_a_temp_remnant() {
        let folder = temporary_folder("atomic-write");
        std::fs::create_dir_all(&folder).expect("create fixture folder");
        let target = folder.join("jump.jdef");
        std::fs::write(&target, "old").expect("write original");
        atomic_write(&target, b"new complete source").expect("atomic replacement");
        assert_eq!(
            std::fs::read_to_string(&target).expect("read replacement"),
            "new complete source"
        );
        assert_eq!(
            std::fs::read_dir(&folder)
                .expect("read fixture folder")
                .count(),
            1
        );
        std::fs::remove_dir_all(&folder).expect("remove fixture folder");
    }

    #[test]
    fn desktop_workspace_save_never_overwrites_original_asset_bytes() {
        let folder = temporary_folder("local-asset-copy");
        let asset_folder = folder.join("assets");
        std::fs::create_dir_all(&asset_folder).expect("create asset fixture folder");
        std::fs::write(folder.join("jump.jdef"), "jump\n  format: 1\n")
            .expect("write fixture source");
        let asset_path = asset_folder.join("pixel.png");
        let original = [137_u8, 80, 78, 71, 1, 2, 3];
        std::fs::write(&asset_path, original).expect("write original asset");
        let value = serde_json::json!({
            "location": "desktop",
            "externalFolder": folder,
            "files": { "jump.jdef": "jump\n  format: 1\n  name: \"Local copy\"\n" },
            "assets": { "assets/pixel.png": [9, 8, 7, 6] }
        });

        save_external_workspace(&value).expect("save workspace sources");

        assert_eq!(
            std::fs::read(&asset_path).expect("read original asset"),
            original
        );
        std::fs::remove_dir_all(&folder).expect("remove fixture folder");
    }
}
