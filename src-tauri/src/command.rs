use std::sync::Mutex;

use persistence::AggregateStore;

pub(crate) struct PersistenceState(pub(crate) Mutex<AggregateStore>);

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CommandError {
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

pub(crate) type CommandResult<T> = Result<T, CommandError>;
