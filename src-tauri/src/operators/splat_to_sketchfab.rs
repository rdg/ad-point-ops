use std::fs::File;
use std::io::BufReader;

use ply_rs::ply::{Addable, DefaultElement, ElementDef, Encoding, Ply, Property, PropertyDef, PropertyType, ScalarType};
use ply_rs::{parser::Parser, writer::Writer};

const SH_C0: f32 = 0.28209479177387814;

fn get_float(elem: &DefaultElement, key: &str) -> Result<f32, String> {
    match elem.get(key) {
        Some(Property::Float(v)) => Ok(*v),
        Some(Property::Double(v)) => Ok(*v as f32),
        _ => Err(format!("vertex missing float property '{key}'")),
    }
}

#[tauri::command]
pub fn splat_to_sketchfab(input_path: String, output_path: String) -> Result<String, String> {
    // Read input PLY
    let file = File::open(&input_path).map_err(|e| format!("Cannot open {input_path}: {e}"))?;
    let mut reader = BufReader::new(file);
    let parser = Parser::<DefaultElement>::new();
    let ply_in = parser
        .read_ply(&mut reader)
        .map_err(|e| format!("Failed to parse PLY: {e}"))?;

    let vertices_in = ply_in
        .payload
        .get("vertex")
        .ok_or("PLY file has no vertex element")?;

    // Convert each vertex
    let mut vertices_out: Vec<DefaultElement> = Vec::with_capacity(vertices_in.len());
    for v in vertices_in {
        let x = get_float(v, "x")?;
        let y = get_float(v, "y")?;
        let z = get_float(v, "z")?;
        let f_dc_0 = get_float(v, "f_dc_0")?;
        let f_dc_1 = get_float(v, "f_dc_1")?;
        let f_dc_2 = get_float(v, "f_dc_2")?;

        let r = ((f_dc_0 * SH_C0 + 0.5).clamp(0.0, 1.0) * 255.0) as u8;
        let g = ((f_dc_1 * SH_C0 + 0.5).clamp(0.0, 1.0) * 255.0) as u8;
        let b = ((f_dc_2 * SH_C0 + 0.5).clamp(0.0, 1.0) * 255.0) as u8;

        let mut out = DefaultElement::new();
        out.insert("x".into(), Property::Float(x));
        out.insert("y".into(), Property::Float(y));
        out.insert("z".into(), Property::Float(z));
        out.insert("red".into(), Property::UChar(r));
        out.insert("green".into(), Property::UChar(g));
        out.insert("blue".into(), Property::UChar(b));
        vertices_out.push(out);
    }

    // Build output PLY header
    let mut ply_out = Ply::<DefaultElement>::new();
    ply_out.header.encoding = Encoding::BinaryLittleEndian;

    let mut vertex_def = ElementDef::new("vertex".into());
    vertex_def.properties.add(PropertyDef::new("x".into(), PropertyType::Scalar(ScalarType::Float)));
    vertex_def.properties.add(PropertyDef::new("y".into(), PropertyType::Scalar(ScalarType::Float)));
    vertex_def.properties.add(PropertyDef::new("z".into(), PropertyType::Scalar(ScalarType::Float)));
    vertex_def.properties.add(PropertyDef::new("red".into(), PropertyType::Scalar(ScalarType::UChar)));
    vertex_def.properties.add(PropertyDef::new("green".into(), PropertyType::Scalar(ScalarType::UChar)));
    vertex_def.properties.add(PropertyDef::new("blue".into(), PropertyType::Scalar(ScalarType::UChar)));

    ply_out.header.elements.add(vertex_def);
    ply_out.payload.insert("vertex".into(), vertices_out);

    // Write output PLY
    let mut out_file = File::create(&output_path)
        .map_err(|e| format!("Cannot create {output_path}: {e}"))?;
    let writer = Writer::new();
    writer
        .write_ply(&mut out_file, &mut ply_out)
        .map_err(|e| format!("Failed to write PLY: {e}"))?;

    Ok(format!("Converted {} vertices → {output_path}", vertices_in.len()))
}
