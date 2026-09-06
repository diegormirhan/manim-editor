#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod project_commands;

fn main() {
    project_commands::log_session("app_start");
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![project_commands::project_action])
        .run(tauri::generate_context!())
        .expect("Could not start manim-editor");
    project_commands::log_session("app_stop");
}
