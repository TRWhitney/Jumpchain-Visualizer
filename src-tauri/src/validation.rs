pub(crate) fn safe_workspace_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 200
        && id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
}

pub(crate) fn validate_welcome_tour_payload(payload: &str) -> Result<(), String> {
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

pub(crate) fn validate_chain_payload(payload: &str) -> Result<serde_json::Value, String> {
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

pub(crate) fn validate_settings_payload(payload: &str) -> Result<(), String> {
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

pub(crate) fn sanitize_suggested_name(suggested_name: &str) -> String {
    suggested_name
        .chars()
        .filter(|character| {
            character.is_ascii_alphanumeric() || ['-', '_', '.'].contains(character)
        })
        .take(100)
        .collect()
}
