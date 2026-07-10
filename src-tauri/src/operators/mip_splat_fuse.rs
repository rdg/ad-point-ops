use std::fs::File;
use std::io::BufReader;

use ply_rs::ply::{Addable, DefaultElement, ElementDef, Encoding, Ply, Property};
use ply_rs::{parser::Parser, writer::Writer};

fn get_float(elem: &DefaultElement, key: &str) -> Result<f32, String> {
    match elem.get(key) {
        Some(Property::Float(v)) => Ok(*v),
        Some(Property::Double(v)) => Ok(*v as f32),
        _ => Err(format!("vertex missing float property '{key}'")),
    }
}

/// Bakes mip-splatting's per-vertex 3D smoothing filter into `opacity` and
/// `scale_*`, matching `GaussianModel.save_fused_ply` in the mip-splatting
/// repo. `opacity` and `scale_*` are stored in logit/log space; `filter_3D`
/// is linear.
fn fuse_vertex(raw_opacity: f32, raw_scale: [f32; 3], filter_3d: f32) -> (f32, [f32; 3]) {
    let filter_sq = filter_3d * filter_3d;

    let scale_sq: [f32; 3] = raw_scale.map(|s| s.exp().powi(2));
    let scale_after_sq: [f32; 3] = scale_sq.map(|sq| sq + filter_sq);

    let det1: f32 = scale_sq.iter().product();
    let det2: f32 = scale_after_sq.iter().product();
    let coef = (det1 / det2).sqrt();

    let opacity_actual = 1.0 / (1.0 + (-raw_opacity).exp());
    let opacity_fused_actual = opacity_actual * coef;
    let opacity_fused_raw = (opacity_fused_actual / (1.0 - opacity_fused_actual)).ln();

    let scale_fused_raw = scale_after_sq.map(|sq| 0.5 * sq.ln());

    (opacity_fused_raw, scale_fused_raw)
}

#[tauri::command]
pub fn mip_splat_fuse(input_path: String, output_path: String) -> Result<String, String> {
    let file = File::open(&input_path).map_err(|e| format!("Cannot open {input_path}: {e}"))?;
    let mut reader = BufReader::new(file);
    let parser = Parser::<DefaultElement>::new();
    let ply_in = parser
        .read_ply(&mut reader)
        .map_err(|e| format!("Failed to parse PLY: {e}"))?;

    let vertex_def_in = ply_in
        .header
        .elements
        .get("vertex")
        .ok_or("PLY file has no vertex element")?;

    if !vertex_def_in.properties.contains_key("filter_3D") {
        return Err(
            "This PLY has no 'filter_3D' property — it doesn't look like a mip-splatting \
             training-output point cloud (iteration_*/point_cloud.ply). Splat → Sketchfab \
             output won't have this field."
                .to_string(),
        );
    }

    let vertices_in = ply_in
        .payload
        .get("vertex")
        .ok_or("PLY file has no vertex element")?;

    // Output keeps every input property in its original order, minus filter_3D.
    let mut vertex_def_out = ElementDef::new("vertex".into());
    for (name, prop_def) in vertex_def_in.properties.iter() {
        if name != "filter_3D" {
            vertex_def_out.properties.add(prop_def.clone());
        }
    }

    let mut vertices_out: Vec<DefaultElement> = Vec::with_capacity(vertices_in.len());
    for v in vertices_in {
        let raw_opacity = get_float(v, "opacity")?;
        let raw_scale = [
            get_float(v, "scale_0")?,
            get_float(v, "scale_1")?,
            get_float(v, "scale_2")?,
        ];
        let filter_3d = get_float(v, "filter_3D")?;

        let (opacity_fused, scale_fused) = fuse_vertex(raw_opacity, raw_scale, filter_3d);

        let mut out = DefaultElement::new();
        for name in vertex_def_out.properties.keys() {
            let value = match name.as_str() {
                "opacity" => Property::Float(opacity_fused),
                "scale_0" => Property::Float(scale_fused[0]),
                "scale_1" => Property::Float(scale_fused[1]),
                "scale_2" => Property::Float(scale_fused[2]),
                _ => v
                    .get(name)
                    .cloned()
                    .ok_or_else(|| format!("vertex missing property '{name}'"))?,
            };
            out.insert(name.clone(), value);
        }
        vertices_out.push(out);
    }

    let mut ply_out = Ply::<DefaultElement>::new();
    ply_out.header.encoding = Encoding::BinaryLittleEndian;
    ply_out.header.elements.add(vertex_def_out);
    ply_out.payload.insert("vertex".into(), vertices_out);

    let mut out_file =
        File::create(&output_path).map_err(|e| format!("Cannot create {output_path}: {e}"))?;
    let writer = Writer::new();
    writer
        .write_ply(&mut out_file, &mut ply_out)
        .map_err(|e| format!("Failed to write PLY: {e}"))?;

    Ok(format!(
        "Fused {} vertices → {output_path}",
        vertices_in.len()
    ))
}

#[cfg(test)]
mod tests {
    use super::fuse_vertex;

    // Cross-checked against a plain-Python port of mip-splatting's
    // GaussianModel.save_fused_ply (exp/log/sigmoid/sqrt only, no torch).
    #[test]
    fn matches_python_oracle() {
        let raw_opacity = 0.5_f32;
        let raw_scale = [-2.0_f32, -1.5_f32, -1.8_f32];
        let filter_3d = 0.05_f32;

        let (opacity_out, scale_out) = fuse_vertex(raw_opacity, raw_scale, filter_3d);

        // Expected values computed independently in Python (see scratchpad
        // oracle script); tolerance covers f32 vs f64 rounding.
        assert!((opacity_out - 0.181_909_86).abs() < 1e-5);
        assert!((scale_out[0] - (-1.936_025_4)).abs() < 1e-5);
        assert!((scale_out[1] - (-1.475_503_1)).abs() < 1e-5);
        assert!((scale_out[2] - (-1.756_225_6)).abs() < 1e-5);
    }
}
