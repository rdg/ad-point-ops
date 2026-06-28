use std::fs::File;
use std::io::BufReader;

use ply_rs::ply::{DefaultElement, Property};
use ply_rs::parser::Parser;
use serde::Serialize;

const MAX_PREVIEW_POINTS: usize = 200_000;
const SH_C0: f32 = 0.28209479177387814;

#[derive(Serialize)]
pub struct PointCloudPreview {
    pub positions: Vec<f32>,
    pub colors: Vec<f32>,
    pub count: usize,
    pub total: usize,
    pub has_rgb: bool,
}

fn get_float(elem: &DefaultElement, key: &str) -> Option<f32> {
    match elem.get(key) {
        Some(Property::Float(v)) => Some(*v),
        Some(Property::Double(v)) => Some(*v as f32),
        _ => None,
    }
}

fn get_uchar(elem: &DefaultElement, key: &str) -> Option<u8> {
    match elem.get(key) {
        Some(Property::UChar(v)) => Some(*v),
        _ => None,
    }
}

#[tauri::command]
pub fn read_ply_preview(path: String) -> Result<PointCloudPreview, String> {
    let file = File::open(&path).map_err(|e| format!("Cannot open {path}: {e}"))?;
    let mut reader = BufReader::new(file);
    let parser = Parser::<DefaultElement>::new();
    let ply = parser
        .read_ply(&mut reader)
        .map_err(|e| format!("Failed to parse PLY: {e}"))?;

    let verts = ply
        .payload
        .get("vertex")
        .ok_or("PLY file has no vertex element")?;

    let total = verts.len();
    let step = (total / MAX_PREVIEW_POINTS).max(1);

    let mut positions: Vec<f32> = Vec::with_capacity((total / step) * 3);
    let mut colors: Vec<f32> = Vec::new();
    let mut has_rgb = false;
    let mut color_source_checked = false;

    for v in verts.iter().step_by(step) {
        let x = get_float(v, "x").unwrap_or(0.0);
        let y = get_float(v, "y").unwrap_or(0.0);
        let z = get_float(v, "z").unwrap_or(0.0);
        positions.push(x);
        positions.push(y);
        positions.push(z);

        if !color_source_checked {
            has_rgb = v.contains_key("red") || v.contains_key("f_dc_0");
            if has_rgb {
                colors.reserve((total / step) * 3);
            }
            color_source_checked = true;
        }

        if has_rgb {
            let (r, g, b) = if let (Some(r), Some(g), Some(b)) = (
                get_uchar(v, "red"),
                get_uchar(v, "green"),
                get_uchar(v, "blue"),
            ) {
                (r as f32 / 255.0, g as f32 / 255.0, b as f32 / 255.0)
            } else {
                let r = get_float(v, "f_dc_0")
                    .map(|f| (f * SH_C0 + 0.5).clamp(0.0, 1.0))
                    .unwrap_or(0.5);
                let g = get_float(v, "f_dc_1")
                    .map(|f| (f * SH_C0 + 0.5).clamp(0.0, 1.0))
                    .unwrap_or(0.5);
                let b = get_float(v, "f_dc_2")
                    .map(|f| (f * SH_C0 + 0.5).clamp(0.0, 1.0))
                    .unwrap_or(0.5);
                (r, g, b)
            };
            colors.push(r);
            colors.push(g);
            colors.push(b);
        }
    }

    let count = positions.len() / 3;
    Ok(PointCloudPreview {
        positions,
        colors,
        count,
        total,
        has_rgb,
    })
}
