mod operators;

use operators::mip_splat_fuse::mip_splat_fuse;
use operators::preview::read_ply_preview;
use operators::splat_to_sketchfab::splat_to_sketchfab;

use tauri::menu::{Menu, MenuItemBuilder, MenuItemKind, PredefinedMenuItem};
use tauri::{AppHandle, Emitter, Wry};

const OPEN_MENU_ID: &str = "open-ply";
const SETTINGS_MENU_ID: &str = "settings";

/// `Menu::default` gives us the OS-standard menu (Edit with cut/copy/paste,
/// Window, Help, etc. — see `tauri::menu::Menu::default`). We add "Open
/// PLY…" and "Settings…" to it rather than rebuilding the whole tree, so
/// nothing standard is lost. We do drop Window/Help/View — this is a
/// single-window utility app, they're just noise. Edit stays: the
/// output-filename field needs its cut/copy/paste/select-all.
///
/// macOS gives us *both* an app-name submenu and a File submenu at once
/// (Menu::default only excludes File on Linux/BSD) — they're mutually
/// exclusive targets below, not "pick whichever," or Settings ends up
/// duplicated in both.
fn build_menu(app: &AppHandle) -> tauri::Result<Menu<Wry>> {
    let menu = Menu::default(app)?;

    let open_item = MenuItemBuilder::new("Open PLY…")
        .id(OPEN_MENU_ID)
        .accelerator("CmdOrCtrl+O")
        .build(app)?;
    let settings_item = MenuItemBuilder::new("Settings…")
        .id(SETTINGS_MENU_ID)
        .accelerator("CmdOrCtrl+,")
        .build(app)?;

    let app_name = app.package_info().name.clone();
    let mut to_remove = Vec::new();

    for item in menu.items()? {
        let MenuItemKind::Submenu(submenu) = item else {
            continue;
        };
        let title = submenu.text()?;

        if title == "File" {
            // Open PLY above Close Window, with a divider.
            submenu.insert(&open_item, 0)?;
            submenu.insert(&PredefinedMenuItem::separator(app)?, 1)?;
            if cfg!(not(target_os = "macos")) {
                // No separate app-name menu here, so Settings joins File too.
                submenu.insert(&settings_item, 2)?;
                submenu.insert(&PredefinedMenuItem::separator(app)?, 3)?;
            }
        } else if title == app_name {
            // macOS app menu convention: About / --- / Settings… / --- / Services / ...
            submenu.insert(&PredefinedMenuItem::separator(app)?, 1)?;
            submenu.insert(&settings_item, 2)?;
        } else if title == "Window" || title == "Help" || title == "View" {
            to_remove.push(submenu);
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
                match event.id().as_ref() {
                    SETTINGS_MENU_ID => {
                        let _ = app_handle.emit("open-settings", ());
                    }
                    OPEN_MENU_ID => {
                        let _ = app_handle.emit("open-file-dialog", ());
                    }
                    _ => {}
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
