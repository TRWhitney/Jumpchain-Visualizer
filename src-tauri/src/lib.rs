use std::{
    collections::HashSet,
    io::Cursor,
    path::{Path, PathBuf},
    sync::Mutex,
    time::{SystemTime, UNIX_EPOCH},
};

use archive_core::{EffectivePackageSizeLimits, inspect_archive, validate_image};
use persistence::AggregateStore;
use tauri::{Manager, State};
use tauri_plugin_dialog::DialogExt;

struct PersistenceState(Mutex<AggregateStore>);

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct CommandError {
    code: String,
    parameters: serde_json::Value,
}

impl CommandError {
    fn from_message(message: &str) -> Self {
        let code = message
            .chars()
            .map(|character| {
                if character.is_ascii_alphanumeric() {
                    character.to_ascii_uppercase()
                } else {
                    '_'
                }
            })
            .collect::<String>()
            .split('_')
            .filter(|part| !part.is_empty())
            .collect::<Vec<_>>()
            .join("_");
        Self {
            code,
            parameters: serde_json::json!({}),
        }
    }
}

impl From<String> for CommandError {
    fn from(message: String) -> Self {
        Self::from_message(&message)
    }
}

impl From<&str> for CommandError {
    fn from(message: &str) -> Self {
        Self::from_message(message)
    }
}

type CommandResult<T> = Result<T, CommandError>;

fn safe_workspace_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 200
        && id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
}

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

fn validate_welcome_tour_payload(payload: &str) -> Result<(), String> {
    const STEP_IDS: &[&str] = &[
        "welcome",
        "home-navigation",
        "home-workspaces",
        "choose-branch",
        "editor-overview",
        "editor-open-details",
        "editor-metadata",
        "editor-add-choice",
        "editor-configure-choice",
        "editor-open-section",
        "editor-place-choice",
        "editor-preview",
        "editor-advanced-offer",
        "editor-advanced-toggle",
        "editor-advanced-tabs",
        "editor-advanced-appearance",
        "editor-advanced-export",
        "editor-summary",
        "tracker-overview",
        "tracker-library",
        "tracker-add-jump",
        "tracker-route-choice",
        "tracker-perk-choice",
        "tracker-item-choice",
        "tracker-reorder",
        "tracker-inventory",
        "tracker-inventory-result",
        "tracker-supplements",
        "tracker-enable-body-mod",
        "tracker-open-body-mod",
        "tracker-use-body-mod",
        "tracker-summary",
        "mode-choice",
    ];
    const EDITOR_FILES: &[&str] = &["jump.jdef", "choices.jdef", "layout.jdef"];
    const PACKAGE_IDS: &[&str] = &[
        "system-earth",
        "welcome-tour-trailhead",
        "welcome-tour-crossroads",
    ];
    if payload.len() > 2 * 1024 * 1024 {
        return Err("welcome tour payload exceeds the application limit".to_owned());
    }
    let value: serde_json::Value =
        serde_json::from_str(payload).map_err(|_| "welcome tour payload is invalid JSON")?;
    if value
        .get("schemaVersion")
        .and_then(serde_json::Value::as_u64)
        != Some(1)
    {
        return Err("welcome tour schema version is unsupported".to_owned());
    }
    if !value
        .get("stepId")
        .and_then(serde_json::Value::as_str)
        .is_some_and(|step| STEP_IDS.contains(&step))
    {
        return Err("welcome tour step is invalid".to_owned());
    }
    let editor = value
        .get("editorWorkspace")
        .and_then(serde_json::Value::as_object)
        .ok_or_else(|| "welcome tour Editor workspace is invalid".to_owned())?;
    if editor.get("id").and_then(serde_json::Value::as_str) != Some("welcome-tour-editor") {
        return Err("welcome tour Editor identity is invalid".to_owned());
    }
    let files = editor
        .get("files")
        .and_then(serde_json::Value::as_object)
        .ok_or_else(|| "welcome tour Editor files are invalid".to_owned())?;
    if files.len() != EDITOR_FILES.len()
        || !files
            .iter()
            .all(|(name, source)| EDITOR_FILES.contains(&name.as_str()) && source.is_string())
    {
        return Err("welcome tour Editor files are invalid".to_owned());
    }
    let packages = value
        .pointer("/trackerState/packages")
        .and_then(serde_json::Value::as_object)
        .ok_or_else(|| "welcome tour Tracker packages are invalid".to_owned())?;
    if packages.len() != PACKAGE_IDS.len()
        || !packages.keys().all(|id| PACKAGE_IDS.contains(&id.as_str()))
    {
        return Err("welcome tour Tracker packages are invalid".to_owned());
    }
    Ok(())
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

fn atomic_write(path: &Path, content: &[u8]) -> Result<(), String> {
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
    let value = validate_editor_workspace_payload(&payload)?;
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

fn validate_chain_payload(payload: &str) -> Result<serde_json::Value, String> {
    if payload.len() > 16 * 1024 * 1024 {
        return Err("chain payload exceeds the application limit".to_owned());
    }
    let value: serde_json::Value =
        serde_json::from_str(payload).map_err(|_| "chain payload is invalid JSON")?;
    if value
        .get("schemaVersion")
        .and_then(serde_json::Value::as_u64)
        != Some(3)
    {
        return Err("chain schema version is unsupported".to_owned());
    }
    let valid_id = value
        .get("id")
        .and_then(serde_json::Value::as_str)
        .is_some_and(|id| !id.is_empty() && id.len() <= 200);
    if !valid_id {
        return Err("chain id is invalid".to_owned());
    }
    Ok(value)
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
        != Some(5)
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

#[cfg(target_os = "linux")]
fn portal_color_to_hex(red: f64, green: f64, blue: f64) -> CommandResult<String> {
    fn channel(value: f64) -> CommandResult<u8> {
        if !value.is_finite() || !(0.0..=1.0).contains(&value) {
            return Err(CommandError::from(
                "screen color sampler returned an invalid channel",
            ));
        }
        #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
        let byte = (value * 255.0).round() as u8;
        Ok(byte)
    }

    Ok(format!(
        "#{:02X}{:02X}{:02X}",
        channel(red)?,
        channel(green)?,
        channel(blue)?
    ))
}

#[tauri::command]
async fn screen_color_sampler_available() -> bool {
    #[cfg(target_os = "linux")]
    {
        ashpd::desktop::screenshot::ScreenshotProxy::new()
            .await
            .is_ok()
    }

    #[cfg(not(target_os = "linux"))]
    false
}

#[tauri::command]
async fn sample_screen_color() -> CommandResult<Option<String>> {
    #[cfg(target_os = "linux")]
    {
        use ashpd::{
            Error,
            desktop::{Color, ResponseError},
        };

        let request = Color::pick()
            .send()
            .await
            .map_err(|_| CommandError::from("screen color sampler could not start"))?;
        let color = match request.response() {
            Ok(color) => color,
            Err(Error::Response(ResponseError::Cancelled)) => return Ok(None),
            Err(Error::Response(ResponseError::Other)) => {
                return Err(CommandError::from("screen color sampler failed"));
            }
            Err(_) => return Err(CommandError::from("screen color sampler failed")),
        };
        portal_color_to_hex(color.red(), color.green(), color.blue()).map(Some)
    }

    #[cfg(not(target_os = "linux"))]
    Err(CommandError::from("screen color sampler is unavailable"))
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn save_diagnostic_report(
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
fn save_editor_package(
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
            load_welcome_tour_session,
            save_welcome_tour_session,
            clear_welcome_tour_session,
            load_chains,
            chains_initialized,
            save_chain,
            remove_chain,
            list_editor_workspaces,
            load_editor_workspace,
            save_editor_workspace,
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
        CommandError, EffectivePackageSizeLimits, atomic_write, read_project_folder,
        safe_workspace_id, sanitize_suggested_name, save_external_workspace,
        validate_chain_payload, validate_settings_payload, validate_welcome_tour_payload,
    };

    #[cfg(target_os = "linux")]
    use super::portal_color_to_hex;

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
