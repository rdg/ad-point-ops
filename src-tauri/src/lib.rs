mod operators;

use operators::mip_splat_fuse::mip_splat_fuse;
use operators::preview::read_ply_preview;
use operators::splat_to_sketchfab::splat_to_sketchfab;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            splat_to_sketchfab,
            mip_splat_fuse,
            read_ply_preview
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
