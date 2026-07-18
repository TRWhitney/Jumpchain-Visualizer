//! Bounded archive inspection boundary shared by native and WASM targets.

use std::collections::HashSet;
use std::io::{Cursor, Read, Seek, SeekFrom};

use serde::{Deserialize, Serialize};
use thiserror::Error;
use zip::CompressionMethod;

const MIB: u64 = 1024 * 1024;
const MAX_ENTRIES: usize = 256;
const MAX_RATIO: u64 = 100;
const MAX_DIMENSION: u64 = 8192;
const MAX_DECODE_DIMENSION: u32 = 8192;
const MAX_IMAGE_PIXELS: u64 = 24_000_000;
const MAX_TOTAL_IMAGE_PIXELS: u64 = 64_000_000;

/// Validated byte budgets passed across the native/WASM boundary.
#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EffectivePackageSizeLimits {
    pub max_archive_mi_b: u64,
    pub max_definition_file_mi_b: u64,
    pub max_asset_file_mi_b: u64,
    pub max_expanded_package_mi_b: u64,
}

impl EffectivePackageSizeLimits {
    /// Validates absolute and relational limits.
    ///
    /// # Errors
    ///
    /// Returns [`ArchiveError::InvalidLimits`] for zero, excessive, or
    /// inconsistent values.
    pub fn validate(self) -> Result<Self, ArchiveError> {
        if self.max_archive_mi_b == 0
            || self.max_archive_mi_b > 512
            || self.max_definition_file_mi_b == 0
            || self.max_definition_file_mi_b > 16
            || self.max_asset_file_mi_b == 0
            || self.max_asset_file_mi_b > 256
            || self.max_expanded_package_mi_b == 0
            || self.max_expanded_package_mi_b > 1024
            || self.max_definition_file_mi_b > self.max_expanded_package_mi_b
            || self.max_asset_file_mi_b > self.max_expanded_package_mi_b
        {
            return Err(ArchiveError::InvalidLimits);
        }
        Ok(self)
    }
}

/// Native archive inspection metadata. Entry contents are intentionally not
/// returned until the entire archive succeeds.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveInspection {
    pub entry_count: usize,
    pub definition_count: usize,
    pub asset_count: usize,
    pub expanded_bytes: u64,
    pub total_image_pixels: u64,
}

/// Stable archive rejection categories used by native and WASM adapters.
#[derive(Debug, Error, PartialEq, Eq)]
pub enum ArchiveError {
    #[error("package limits are invalid")]
    InvalidLimits,
    #[error("archive exceeds its effective byte limit")]
    ArchiveLimit,
    #[error("archive headers are malformed or unsupported")]
    Malformed,
    #[error("archive contains too many entries")]
    EntryCount,
    #[error("archive contains an unsafe path")]
    UnsafePath,
    #[error("archive contains duplicate or case-folded paths")]
    PathCollision,
    #[error("archive contains an unexpected entry type")]
    EntryType,
    #[error("archive contains a link, directory, device, or special entry")]
    SpecialEntry,
    #[error("archive uses an unsupported compression method")]
    Compression,
    #[error("archive exceeds a mandatory compression ratio")]
    CompressionRatio,
    #[error("an expanded file exceeds its effective byte limit")]
    FileLimit,
    #[error("expanded package data exceeds its effective byte limit")]
    ExpandedLimit,
    #[error("an archive stream is corrupt or truncated")]
    CorruptStream,
    #[error("an image signature or geometry is invalid")]
    InvalidImage,
    #[error("decoded images exceed mandatory pixel limits")]
    ImageLimit,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum EntryKind {
    Definition,
    Asset,
}

fn classify_path(path: &str) -> Result<EntryKind, ArchiveError> {
    if path.is_empty()
        || path.contains('\0')
        || path.contains('\\')
        || path.starts_with('/')
        || path.ends_with('/')
        || path.as_bytes().get(1) == Some(&b':')
    {
        return Err(ArchiveError::UnsafePath);
    }
    let segments: Vec<_> = path.split('/').collect();
    if segments
        .iter()
        .any(|segment| segment.is_empty() || *segment == "." || *segment == "..")
    {
        return Err(ArchiveError::UnsafePath);
    }
    if segments.len() == 1 && path.to_ascii_lowercase().ends_with(".jdef") {
        return Ok(EntryKind::Definition);
    }
    let extension = path.rsplit_once('.').map_or("", |(_, value)| value);
    if segments.len() >= 2
        && segments[0] == "assets"
        && ["png", "jpg", "jpeg", "gif", "webp", "avif"]
            .contains(&extension.to_ascii_lowercase().as_str())
    {
        return Ok(EntryKind::Asset);
    }
    Err(ArchiveError::EntryType)
}

fn big_endian_u32(bytes: &[u8], offset: usize) -> Option<u64> {
    Some(u64::from(u32::from_be_bytes(
        bytes.get(offset..offset + 4)?.try_into().ok()?,
    )))
}

fn little_endian_u16(bytes: &[u8], offset: usize) -> Option<u64> {
    Some(u64::from(u16::from_le_bytes(
        bytes.get(offset..offset + 2)?.try_into().ok()?,
    )))
}

fn validate_png(bytes: &[u8]) -> Result<(), ArchiveError> {
    if bytes.get(..8) != Some(&[137, 80, 78, 71, 13, 10, 26, 10]) {
        return Err(ArchiveError::InvalidImage);
    }
    let mut offset = 8_usize;
    let mut saw_header = false;
    loop {
        let length =
            usize::try_from(big_endian_u32(bytes, offset).ok_or(ArchiveError::InvalidImage)?)
                .map_err(|_| ArchiveError::InvalidImage)?;
        let kind = bytes
            .get(offset + 4..offset + 8)
            .ok_or(ArchiveError::InvalidImage)?;
        let data_end = offset
            .checked_add(8)
            .and_then(|value| value.checked_add(length))
            .ok_or(ArchiveError::InvalidImage)?;
        let chunk_end = data_end.checked_add(4).ok_or(ArchiveError::InvalidImage)?;
        let expected =
            u32::try_from(big_endian_u32(bytes, data_end).ok_or(ArchiveError::InvalidImage)?)
                .map_err(|_| ArchiveError::InvalidImage)?;
        if crc32fast::hash(
            bytes
                .get(offset + 4..data_end)
                .ok_or(ArchiveError::InvalidImage)?,
        ) != expected
        {
            return Err(ArchiveError::InvalidImage);
        }
        if !saw_header {
            if kind != b"IHDR" || length != 13 {
                return Err(ArchiveError::InvalidImage);
            }
            saw_header = true;
        } else if kind == b"IHDR" {
            return Err(ArchiveError::InvalidImage);
        }
        if kind == b"IEND" {
            return if length == 0 && chunk_end == bytes.len() {
                Ok(())
            } else {
                Err(ArchiveError::InvalidImage)
            };
        }
        offset = chunk_end;
        if offset >= bytes.len() {
            return Err(ArchiveError::InvalidImage);
        }
    }
}

fn image_format(extension: &str) -> Option<image::ImageFormat> {
    match extension {
        "png" => Some(image::ImageFormat::Png),
        "gif" => Some(image::ImageFormat::Gif),
        "jpg" | "jpeg" => Some(image::ImageFormat::Jpeg),
        "webp" => Some(image::ImageFormat::WebP),
        _ => None,
    }
}

/// Performs bounded structural and full-decoder validation for one supported
/// raster asset before its bytes may leave the package staging boundary.
///
/// # Errors
///
/// Returns [`ArchiveError::InvalidImage`] for malformed, truncated, signature-
/// mismatched, or polyglot image data and [`ArchiveError::ImageLimit`] when
/// decoded geometry or allocation budgets would be exceeded.
pub fn validate_image(path: &str, bytes: &[u8]) -> Result<(u64, u64), ArchiveError> {
    let extension = path
        .rsplit_once('.')
        .map_or("", |(_, value)| value)
        .to_ascii_lowercase();
    let (width, height) = match extension.as_str() {
        "png" => {
            validate_png(bytes)?;
            (
                big_endian_u32(bytes, 16).ok_or(ArchiveError::InvalidImage)?,
                big_endian_u32(bytes, 20).ok_or(ArchiveError::InvalidImage)?,
            )
        }
        "gif" => {
            if !matches!(bytes.get(..6), Some(b"GIF87a" | b"GIF89a")) || bytes.last() != Some(&0x3b)
            {
                return Err(ArchiveError::InvalidImage);
            }
            (
                little_endian_u16(bytes, 6).ok_or(ArchiveError::InvalidImage)?,
                little_endian_u16(bytes, 8).ok_or(ArchiveError::InvalidImage)?,
            )
        }
        "jpg" | "jpeg" => jpeg_geometry(bytes)?,
        "webp" => {
            if bytes.get(..4) != Some(b"RIFF")
                || bytes.get(8..12) != Some(b"WEBP")
                || bytes.get(12..16) != Some(b"VP8X")
                || little_endian_u32(bytes, 4).and_then(|size| size.checked_add(8))
                    != Some(bytes.len() as u64)
            {
                return Err(ArchiveError::InvalidImage);
            }
            let width = 1
                + u64::from(*bytes.get(24).ok_or(ArchiveError::InvalidImage)?)
                + (u64::from(*bytes.get(25).ok_or(ArchiveError::InvalidImage)?) << 8)
                + (u64::from(*bytes.get(26).ok_or(ArchiveError::InvalidImage)?) << 16);
            let height = 1
                + u64::from(*bytes.get(27).ok_or(ArchiveError::InvalidImage)?)
                + (u64::from(*bytes.get(28).ok_or(ArchiveError::InvalidImage)?) << 8)
                + (u64::from(*bytes.get(29).ok_or(ArchiveError::InvalidImage)?) << 16);
            (width, height)
        }
        "avif" => {
            if bytes.get(4..8) != Some(b"ftyp")
                || !bytes
                    .get(8..32)
                    .is_some_and(|value| value.windows(4).any(|part| part == b"avif"))
            {
                return Err(ArchiveError::InvalidImage);
            }
            let offset = (4..bytes.len().saturating_sub(16))
                .find(|offset| bytes.get(*offset..*offset + 4) == Some(b"ispe"))
                .ok_or(ArchiveError::InvalidImage)?;
            (
                big_endian_u32(bytes, offset + 8).ok_or(ArchiveError::InvalidImage)?,
                big_endian_u32(bytes, offset + 12).ok_or(ArchiveError::InvalidImage)?,
            )
        }
        _ => return Err(ArchiveError::EntryType),
    };
    let pixels = width.saturating_mul(height);
    if width == 0
        || height == 0
        || width > MAX_DIMENSION
        || height > MAX_DIMENSION
        || pixels > MAX_IMAGE_PIXELS
    {
        return Err(ArchiveError::ImageLimit);
    }
    if let Some(format) = image_format(&extension) {
        let mut decoder = image::ImageReader::with_format(Cursor::new(bytes), format);
        let mut decode_limits = image::Limits::default();
        decode_limits.max_image_width = Some(MAX_DECODE_DIMENSION);
        decode_limits.max_image_height = Some(MAX_DECODE_DIMENSION);
        decode_limits.max_alloc = Some(128 * MIB);
        decoder.limits(decode_limits);
        let raster = decoder.decode().map_err(|_| ArchiveError::InvalidImage)?;
        if u64::from(raster.width()) != width || u64::from(raster.height()) != height {
            return Err(ArchiveError::InvalidImage);
        }
    }
    Ok((width, height))
}

fn little_endian_u32(bytes: &[u8], offset: usize) -> Option<u64> {
    Some(u64::from(u32::from_le_bytes(
        bytes.get(offset..offset + 4)?.try_into().ok()?,
    )))
}

fn jpeg_geometry(bytes: &[u8]) -> Result<(u64, u64), ArchiveError> {
    if bytes.get(..2) != Some(&[0xff, 0xd8]) {
        return Err(ArchiveError::InvalidImage);
    }
    if bytes.get(bytes.len().saturating_sub(2)..) != Some(&[0xff, 0xd9]) {
        return Err(ArchiveError::InvalidImage);
    }
    let mut geometry = None;
    let mut offset = 2;
    while offset + 9 <= bytes.len() {
        if bytes[offset] != 0xff {
            offset += 1;
            continue;
        }
        let marker = bytes[offset + 1];
        let length = usize::from(u16::from_be_bytes([bytes[offset + 2], bytes[offset + 3]]));
        if length < 2 || offset + 2 + length > bytes.len() {
            return Err(ArchiveError::InvalidImage);
        }
        if [
            0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
        ]
        .contains(&marker)
        {
            geometry = Some((
                u64::from(u16::from_be_bytes([bytes[offset + 7], bytes[offset + 8]])),
                u64::from(u16::from_be_bytes([bytes[offset + 5], bytes[offset + 6]])),
            ));
            break;
        }
        offset += 2 + length;
    }
    geometry.ok_or(ArchiveError::InvalidImage)
}

/// Streams every supported ZIP entry through validated byte and ratio budgets.
/// No expanded data is exposed to the caller.
///
/// # Errors
///
/// Returns a stable [`ArchiveError`] when any archive, path, type, ratio, byte,
/// integrity, or image invariant fails.
#[allow(clippy::too_many_lines)]
pub fn inspect_archive<R: Read + Seek>(
    mut reader: R,
    limits: EffectivePackageSizeLimits,
) -> Result<ArchiveInspection, ArchiveError> {
    let limits = limits.validate()?;
    let archive_size = reader
        .seek(SeekFrom::End(0))
        .map_err(|_| ArchiveError::Malformed)?;
    if archive_size > limits.max_archive_mi_b * MIB {
        return Err(ArchiveError::ArchiveLimit);
    }
    reader
        .seek(SeekFrom::Start(0))
        .map_err(|_| ArchiveError::Malformed)?;
    let mut archive = zip::ZipArchive::new(reader).map_err(|_| ArchiveError::Malformed)?;
    if archive.is_empty() || archive.len() > MAX_ENTRIES {
        return Err(ArchiveError::EntryCount);
    }
    let mut names = HashSet::new();
    let mut definitions = 0;
    let mut assets = 0;
    let mut expanded_total = 0_u64;
    let mut compressed_total = 0_u64;
    let mut image_pixels = 0_u64;
    for index in 0..archive.len() {
        let mut file = archive
            .by_index(index)
            .map_err(|_| ArchiveError::CorruptStream)?;
        let name = file.name().to_owned();
        let kind = classify_path(&name)?;
        let folded = name.to_lowercase();
        if !names.insert(folded) {
            return Err(ArchiveError::PathCollision);
        }
        if file.encrypted() {
            return Err(ArchiveError::SpecialEntry);
        }
        if file.is_dir()
            || file
                .unix_mode()
                .is_some_and(|mode| mode & 0o170_000 != 0 && mode & 0o170_000 != 0o100_000)
        {
            return Err(ArchiveError::SpecialEntry);
        }
        if !matches!(
            file.compression(),
            CompressionMethod::Stored | CompressionMethod::Deflated
        ) {
            return Err(ArchiveError::Compression);
        }
        let compressed = file.compressed_size();
        if compressed == 0 && file.size() > 0
            || compressed > 0 && file.size() > compressed.saturating_mul(MAX_RATIO)
        {
            return Err(ArchiveError::CompressionRatio);
        }
        compressed_total = compressed_total.saturating_add(compressed);
        let limit = match kind {
            EntryKind::Definition => limits.max_definition_file_mi_b * MIB,
            EntryKind::Asset => limits.max_asset_file_mi_b * MIB,
        };
        let mut content = Vec::new();
        let mut buffer = vec![0_u8; 64 * 1024];
        let mut actual = 0_u64;
        loop {
            let read = file
                .read(&mut buffer)
                .map_err(|_| ArchiveError::CorruptStream)?;
            if read == 0 {
                break;
            }
            actual = actual.saturating_add(read as u64);
            expanded_total = expanded_total.saturating_add(read as u64);
            if actual > limit {
                return Err(ArchiveError::FileLimit);
            }
            if expanded_total > limits.max_expanded_package_mi_b * MIB {
                return Err(ArchiveError::ExpandedLimit);
            }
            if compressed == 0 || actual > compressed.saturating_mul(MAX_RATIO) {
                return Err(ArchiveError::CompressionRatio);
            }
            if kind == EntryKind::Asset {
                content.extend_from_slice(&buffer[..read]);
            }
        }
        if actual != file.size() {
            return Err(ArchiveError::CorruptStream);
        }
        match kind {
            EntryKind::Definition => definitions += 1,
            EntryKind::Asset => {
                assets += 1;
                let (width, height) = validate_image(&name, &content)?;
                let pixels = width.saturating_mul(height);
                if width == 0
                    || height == 0
                    || width > MAX_DIMENSION
                    || height > MAX_DIMENSION
                    || pixels > MAX_IMAGE_PIXELS
                {
                    return Err(ArchiveError::ImageLimit);
                }
                image_pixels = image_pixels.saturating_add(pixels);
                if image_pixels > MAX_TOTAL_IMAGE_PIXELS {
                    return Err(ArchiveError::ImageLimit);
                }
            }
        }
    }
    if compressed_total == 0 && expanded_total > 0
        || compressed_total > 0 && expanded_total > compressed_total.saturating_mul(MAX_RATIO)
    {
        return Err(ArchiveError::CompressionRatio);
    }
    Ok(ArchiveInspection {
        entry_count: archive.len(),
        definition_count: definitions,
        asset_count: assets,
        expanded_bytes: expanded_total,
        total_image_pixels: image_pixels,
    })
}

#[cfg(test)]
mod tests {
    use std::io::{Cursor, Write};

    use image::ImageEncoder;

    use super::{ArchiveError, EffectivePackageSizeLimits, inspect_archive, validate_image};
    use zip::{CompressionMethod, write::SimpleFileOptions};

    fn limits() -> EffectivePackageSizeLimits {
        EffectivePackageSizeLimits {
            max_archive_mi_b: 64,
            max_definition_file_mi_b: 2,
            max_asset_file_mi_b: 16,
            max_expanded_package_mi_b: 96,
        }
    }

    fn archive(path: &str, content: &[u8]) -> Vec<u8> {
        let mut output = Cursor::new(Vec::new());
        {
            let mut writer = zip::ZipWriter::new(&mut output);
            writer
                .start_file(path, SimpleFileOptions::default())
                .expect("start entry");
            writer.write_all(content).expect("write entry");
            writer.finish().expect("finish archive");
        }
        output.into_inner()
    }

    fn one_pixel_png() -> Vec<u8> {
        let mut output = Vec::new();
        image::codecs::png::PngEncoder::new(&mut output)
            .write_image(&[0, 0, 0, 255], 1, 1, image::ExtendedColorType::Rgba8)
            .expect("encode png fixture");
        output
    }

    #[test]
    fn validates_limits_and_safe_source() {
        assert_eq!(limits().validate(), Ok(limits()));
        let result = inspect_archive(
            Cursor::new(archive("jump.jdef", b"jump\n  format: 1\n")),
            limits(),
        )
        .expect("safe archive");
        assert_eq!(result.definition_count, 1);
        assert_eq!(result.asset_count, 0);
    }

    #[test]
    fn blocks_traversal_and_compression_bombs() {
        assert_eq!(
            inspect_archive(Cursor::new(archive("../jump.jdef", b"jump")), limits()),
            Err(ArchiveError::UnsafePath)
        );
        let content = vec![b'a'; 500_000];
        let mut output = Cursor::new(Vec::new());
        {
            let mut writer = zip::ZipWriter::new(&mut output);
            writer
                .start_file(
                    "jump.jdef",
                    SimpleFileOptions::default().compression_method(CompressionMethod::Deflated),
                )
                .expect("start entry");
            writer.write_all(&content).expect("write entry");
            writer.finish().expect("finish archive");
        }
        assert_eq!(
            inspect_archive(Cursor::new(output.into_inner()), limits()),
            Err(ArchiveError::CompressionRatio)
        );
    }

    #[test]
    fn fully_decodes_images_and_rejects_polyglot_trailing_bytes() {
        let png = one_pixel_png();
        assert_eq!(validate_image("assets/pixel.png", &png), Ok((1, 1)));
        let result = inspect_archive(Cursor::new(archive("assets/pixel.png", &png)), limits())
            .expect("safe raster asset");
        assert_eq!(result.asset_count, 1);
        let mut polyglot = png;
        polyglot.extend_from_slice(b"<script>");
        assert_eq!(
            validate_image("assets/pixel.png", &polyglot),
            Err(ArchiveError::InvalidImage)
        );
    }
}
