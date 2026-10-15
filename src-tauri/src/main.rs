#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod project_commands;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![project_commands::project_action, project_commands::cancel_render, project_commands::render_progress, project_commands::live_frame, project_commands::launch_file])
        .run(tauri::generate_context!())
        .expect("Could not start manim-editor");
}
