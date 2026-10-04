#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod project_commands;

fn main() {
    project_commands::log_session("app_start");
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![project_commands::project_action, project_commands::cancel_render, project_commands::render_progress])
        .run(tauri::generate_context!())
        .expect("Could not start manim-editor");
    project_commands::log_session("app_stop");
}
