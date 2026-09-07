use serde_json::{json, Value};
use std::{fs::OpenOptions, io::Write, path::PathBuf, process::{Command, Stdio}, sync::atomic::{AtomicBool, Ordering}, time::{SystemTime, UNIX_EPOCH}};
use tauri::Manager;
#[cfg(windows)]
use std::os::windows::process::CommandExt;

static BUSY: AtomicBool = AtomicBool::new(false);

pub fn log_session(event: &str) {
    let path = project_root().join(".session.log");
    let timestamp = SystemTime::now().duration_since(UNIX_EPOCH).map(|value| value.as_secs()).unwrap_or_default();
    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(path) {
        let _ = writeln!(file, "{}\t{}", timestamp, event);
    }
}
struct BusyGuard;
impl Drop for BusyGuard {
    fn drop(&mut self) { BUSY.store(false, Ordering::Release); }
}

fn project_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).parent().unwrap().to_path_buf()
}

fn execute_bridge(request: Value) -> Result<Value, String> {
    let root = project_root();
    let python = root.join(".venv/Scripts/python.exe");
    if !python.is_file() {
        return Err("Local Python environment missing. See README.md.".into());
    }
    let mut command = Command::new(python);
    command.args(["-m", "renderer.manim_renderer.desktop_bridge"])
        .current_dir(&root).stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped());
    #[cfg(windows)]
    command.creation_flags(0x08000000);
    let mut child = command.spawn().map_err(|error| error.to_string())?;
    let payload = serde_json::to_vec(&request).map_err(|error| error.to_string())?;
    if let Err(error) = child.stdin.take().unwrap().write_all(&payload) {
        let _ = child.kill();
        let _ = child.wait();
        return Err(error.to_string());
    }
    let output = child.wait_with_output().map_err(|error| error.to_string())?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }
    serde_json::from_slice(&output.stdout).map_err(|error| error.to_string())
}

fn perform_action(operation: &str, project: Value) -> Result<Value, String> {
    if !["load", "save", "export", "render"].contains(&operation) {
        return Err("Unknown operation.".into());
    }
    let path = match operation {
        "load" => rfd::FileDialog::new().add_filter("JSON project", &["json"]).pick_file(),
        "save" => rfd::FileDialog::new().add_filter("JSON project", &["json"]).set_file_name("project.json").save_file(),
        "export" => rfd::FileDialog::new().add_filter("Python", &["py"]).set_file_name("scene.py").save_file(),
        _ => None,
    };
    if operation != "render" && path.is_none() { return Ok(json!({"cancelled": true})); }
    execute_bridge(json!({"operation": operation, "project": project, "path": path}))
}

#[tauri::command]
pub async fn project_action(app: tauri::AppHandle, operation: String, project: Value) -> Result<Value, String> {
    log_session(&format!("operation_start:{}", operation));
    if BUSY.swap(true, Ordering::AcqRel) { return Err("Another operation is in progress.".into()); }
    let guard = BusyGuard;
    let is_render = operation == "render";
    let requested = operation.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        let _guard = guard;
        perform_action(&requested, project)
    }).await.map_err(|error| error.to_string())??;
    if is_render {
        if let Some(path) = result.get("path").and_then(Value::as_str) {
            app.asset_protocol_scope().allow_file(path).map_err(|error| error.to_string())?;
        }
    }
    log_session(&format!("operation_end:{}", operation));
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn bridge_loads_valid_project() {
        let result = execute_bridge(json!({"operation": "load", "path": project_root().join("examples/equation.json")})).unwrap();
        assert_eq!(result["project"]["schemaVersion"], 1);
    }
    #[test]
    fn rejects_unknown_command() {
        assert!(perform_action("shell", Value::Null).is_err());
    }
    #[test]
    fn bridge_renders_real_video() {
        let project: Value = serde_json::from_str(&std::fs::read_to_string(project_root().join("examples/equation.json")).unwrap()).unwrap();
        let result = execute_bridge(json!({"operation": "render", "project": project})).unwrap();
        assert!(PathBuf::from(result["path"].as_str().unwrap()).is_file());
    }
}
