mod operators;

use operators::mip_splat_fuse::mip_splat_fuse;
use operators::preview::read_ply_preview;
use operators::splat_to_sketchfab::splat_to_sketchfab;

use tauri::menu::{Menu, MenuItemBuilder, MenuItemKind};
use tauri::{AppHandle, Emitter, Wry};

const SETTINGS_MENU_ID: &str = "settings";

/// `Menu::default` gives us the OS-standard menu (Edit with cut/copy/paste,
/// Window, Help, etc. — see `tauri::menu::Menu::default`). We insert a
/// "Settings…" item into the app menu (macOS) or File menu (Windows/Linux)
/// rather than rebuilding the whole tree, so nothing standard is lost there.
/// We do drop the Window/Help/View submenus — this is a single-window
/// utility app, so they're just noise. Edit stays: the output-filename
/// field needs its cut/copy/paste/select-all.
fn build_menu(app: &AppHandle) -> tauri::Result<Menu<Wry>> {
    let menu = Menu::default(app)?;
    let settings_item = MenuItemBuilder::new("Settings…")
        .id(SETTINGS_MENU_ID)
        .accelerator("CmdOrCtrl+,")
        .build(app)?;

    let app_name = &app.package_info().name;
    let mut to_remove = Vec::new();
    for item in menu.items()? {
        if let MenuItemKind::Submenu(submenu) = item {
            let title = submenu.text()?;
            if &title == app_name || title == "File" {
                submenu.insert(&settings_item, 1)?;
            } else if title == "Window" || title == "Help" || title == "View" {
                to_remove.push(submenu);
            }
        }
    }
    for submenu in to_remove {
        menu.remove(&submenu)?;
    }

    Ok(menu)
}

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

            let menu = build_menu(app.handle())?;
            app.set_menu(menu)?;
            app.on_menu_event(|app_handle, event| {
                if event.id().as_ref() == SETTINGS_MENU_ID {
                    let _ = app_handle.emit("open-settings", ());
                }
            });

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
