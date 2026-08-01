use crate::command::{CommandError, CommandResult};

#[cfg(target_os = "linux")]
pub(crate) fn portal_color_to_hex(red: f64, green: f64, blue: f64) -> CommandResult<String> {
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
pub(crate) async fn screen_color_sampler_available() -> bool {
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
pub(crate) async fn sample_screen_color() -> CommandResult<Option<String>> {
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
