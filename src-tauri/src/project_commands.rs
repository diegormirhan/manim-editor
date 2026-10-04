use serde_json::{json, Value};
use std::{fs::OpenOptions, io::{BufRead, BufReader, Write}, path::PathBuf, process::{Command, Stdio}, sync::{atomic::{AtomicBool, Ordering}, Mutex}, time::{SystemTime, UNIX_EPOCH}};
use tauri::Manager;
#[cfg(windows)]
use std::os::windows::process::CommandExt;

static BUSY: AtomicBool = AtomicBool::new(false);
static CANCELLED: AtomicBool = AtomicBool::new(false);
/// Process id of the running bridge, so a render can be cancelled.
static CHILD: Mutex<Option<u32>> = Mutex::new(None);
/// Files the user picked in a dialog; only these may be written without asking again.
static DOCUMENTS: Mutex<Vec<PathBuf>> = Mutex::new(Vec::new());
/// The latest progress event of the running render, for the interface to poll.
static PROGRESS: Mutex<Option<Value>> = Mutex::new(None);

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

/// Locates the runtime payload (`.venv`, `renderer`, `contracts`, `work/runtime`).
///
/// An installed build places those next to the executable via Tauri's bundle
/// resources, so that directory wins first. A `cargo run`/`cargo build` binary
/// lives under `src-tauri/target/<profile>/`, three directories below the repo
/// root, so that layout is tried next. `CARGO_MANIFEST_DIR` is a compile-time
/// constant baked into the binary; it only resolves on the machine that built
/// it, so it is the last resort rather than the primary lookup.
fn project_root() -> PathBuf {
    let fallback = || PathBuf::from(env!("CARGO_MANIFEST_DIR")).parent().unwrap().to_path_buf();
    match std::env::current_exe() {
        Ok(exe) => root_from_exe(&exe).unwrap_or_else(fallback),
        Err(_) => fallback(),
    }
}

/// Pure helper behind `project_root` so the installed-vs-dev layout logic is testable
/// without depending on the real `current_exe()` of the test binary itself.
fn root_from_exe(exe: &std::path::Path) -> Option<PathBuf> {
    let installed = exe.parent()?;
    if installed.join(".venv").is_dir() {
        return Some(installed.to_path_buf());
    }
    let repo = installed.parent()?.parent()?.parent()?;
    repo.join(".venv").is_dir().then(|| repo.to_path_buf())
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
    *CHILD.lock().unwrap() = Some(child.id());
    // stderr carries progress events between the lines that explain a failure, so it is read as it arrives.
    let stderr = child.stderr.take().unwrap();
    let reader = std::thread::spawn(move || {
        let mut problems = Vec::new();
        for line in BufReader::new(stderr).lines().map_while(Result::ok) {
            match progress_event(&line) {
                Some(event) => *PROGRESS.lock().unwrap() = Some(event),
                None => problems.push(line),
            }
        }
        problems.join("\n")
    });
    let payload = serde_json::to_vec(&request).map_err(|error| error.to_string())?;
    if let Err(error) = child.stdin.take().unwrap().write_all(&payload) {
        let _ = child.kill();
        let _ = child.wait();
        let _ = reader.join();
        *CHILD.lock().unwrap() = None;
        return Err(error.to_string());
    }
    let output = child.wait_with_output();
    *CHILD.lock().unwrap() = None;
    let problems = reader.join().unwrap_or_default();
    let output = output.map_err(|error| error.to_string())?;
    if !output.status.success() {
        return Err(problems.trim().to_string());
    }
    serde_json::from_slice(&output.stdout).map_err(|error| error.to_string())
}

/// A newline-delimited JSON progress event from the bridge, or `None` for any other stderr line.
fn progress_event(line: &str) -> Option<Value> {
    let value: Value = serde_json::from_str(line).ok()?;
    (value.get("event")? == "progress").then_some(value)
}

/// The suggested file name for an exported video: the project's name with the format's extension.
fn video_file_name(project: &Value, extension: &str) -> String {
    let name: String = project.get("name").and_then(Value::as_str).unwrap_or_default().chars()
        .filter(|c| c.is_alphanumeric() || " -_".contains(*c)).collect();
    let name = name.trim();
    format!("{}.{}", if name.is_empty() { "scene" } else { name }, extension)
}

/// Kills the running bridge and everything it started (Manim, LaTeX).
fn cancel_running() -> bool {
    let Some(pid) = *CHILD.lock().unwrap() else { return false };
    CANCELLED.store(true, Ordering::Release);
    #[cfg(windows)]
    let status = Command::new("taskkill").args(["/PID", &pid.to_string(), "/T", "/F"])
        .creation_flags(0x08000000).stdout(Stdio::null()).stderr(Stdio::null()).status();
    #[cfg(not(windows))]
    let status = Command::new("kill").args(["-9", &pid.to_string()]).status();
    status.map(|status| status.success()).unwrap_or(false)
}

/// Where a save writes: the document's own file once the user chose it, otherwise a dialog.
fn document_path(operation: &str, known: Option<PathBuf>) -> Option<PathBuf> {
    if operation == "save" {
        if let Some(path) = known.as_ref().filter(|path| DOCUMENTS.lock().unwrap().contains(path)) {
            return Some(path.clone());
        }
    }
    let name = known.as_ref().and_then(|path| path.file_name()).map(|name| name.to_string_lossy().into_owned());
    let picked = rfd::FileDialog::new().add_filter("JSON project", &["json"])
        .set_file_name(name.unwrap_or_else(|| "project.json".into())).save_file()?;
    DOCUMENTS.lock().unwrap().push(picked.clone());
    Some(picked)
}

/// A project from the recent list opens without a dialog, so it must still be a JSON file on disk.
fn recent_document(known: Option<PathBuf>) -> Result<PathBuf, String> {
    let path = known.filter(|path| path.extension().is_some_and(|extension| extension.eq_ignore_ascii_case("json")))
        .ok_or("Only project files (.json) can be reopened.")?;
    if !path.is_file() { return Err("The project file was moved, renamed or deleted.".into()); }
    Ok(path)
}

fn perform_action(operation: &str, project: Value, known: Option<PathBuf>, options: Option<Value>) -> Result<Value, String> {
    if !["load", "openRecent", "save", "saveAs", "export", "exportVideo", "render"].contains(&operation) {
        return Err("Unknown operation.".into());
    }
    let path = match operation {
        "load" => rfd::FileDialog::new().add_filter("JSON project", &["json"]).pick_file(),
        "openRecent" => Some(recent_document(known)?),
        "save" | "saveAs" => document_path(operation, known),
        "export" => rfd::FileDialog::new().add_filter("Python", &["py"]).set_file_name("scene.py").save_file(),
        "exportVideo" => {
            // Python validates the format; here it only names the dialog's filter and suggested file.
            let extension = options.as_ref().and_then(|options| options.get("format")).and_then(Value::as_str)
                .filter(|format| ["mp4", "webm", "gif", "mov"].contains(format)).unwrap_or("mp4");
            rfd::FileDialog::new().add_filter("Video", &[extension])
                .set_file_name(video_file_name(&project, extension)).save_file()
        }
        _ => None,
    };
    if operation != "render" && path.is_none() { return Ok(json!({"cancelled": true})); }
    let bridge_operation = match operation { "saveAs" => "save", "openRecent" => "load", other => other };
    let mut result = execute_bridge(json!({"operation": bridge_operation, "project": project, "path": path, "options": options}))?;
    if bridge_operation == "load" {
        let path = path.unwrap();
        result["path"] = json!(path);
        DOCUMENTS.lock().unwrap().push(path);
    }
    Ok(result)
}

#[tauri::command]
pub async fn project_action(app: tauri::AppHandle, operation: String, project: Value, path: Option<PathBuf>, options: Option<Value>) -> Result<Value, String> {
    log_session(&format!("operation_start:{}", operation));
    if BUSY.swap(true, Ordering::AcqRel) { return Err("Another operation is in progress.".into()); }
    let guard = BusyGuard;
    CANCELLED.store(false, Ordering::Release);
    *PROGRESS.lock().unwrap() = None;
    let is_render = operation == "render";
    let requested = operation.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        let _guard = guard;
        perform_action(&requested, project, path, options)
    }).await.map_err(|error| error.to_string())?;
    *PROGRESS.lock().unwrap() = None;
    if CANCELLED.swap(false, Ordering::AcqRel) {
        log_session(&format!("operation_cancelled:{}", operation));
        return Ok(json!({"cancelled": true}));
    }
    let result = result?;
    if is_render {
        if let Some(path) = result.get("path").and_then(Value::as_str) {
            app.asset_protocol_scope().allow_file(path).map_err(|error| error.to_string())?;
        }
    }
    log_session(&format!("operation_end:{}", operation));
    Ok(result)
}

#[tauri::command]
pub fn cancel_render() -> bool {
    log_session("cancel_requested");
    cancel_running()
}

#[tauri::command]
pub fn render_progress() -> Option<Value> {
    PROGRESS.lock().unwrap().clone()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{Duration, Instant};
    // Bridge tests share the running-child slot, so they take turns.
    static BRIDGE: Mutex<()> = Mutex::new(());
    #[test]
    fn bridge_loads_valid_project() {
        let _turn = BRIDGE.lock().unwrap_or_else(|poison| poison.into_inner());
        let result = execute_bridge(json!({"operation": "load", "path": project_root().join("examples/equation.json")})).unwrap();
        assert_eq!(result["project"]["schemaVersion"], 1);
    }
    #[test]
    fn rejects_unknown_command() {
        assert!(perform_action("shell", Value::Null, None, None).is_err());
    }
    #[test]
    fn root_from_exe_prefers_an_installed_payload_next_to_the_binary() {
        let temp = std::env::temp_dir().join(format!("manim-editor-root-test-{}", std::process::id()));
        let installed = temp.join("installed");
        std::fs::create_dir_all(installed.join(".venv")).unwrap();
        assert_eq!(root_from_exe(&installed.join("manim-editor.exe")), Some(installed.clone()));
        std::fs::remove_dir_all(&temp).unwrap();
    }
    #[test]
    fn root_from_exe_falls_back_to_the_repo_root_of_a_dev_build() {
        let temp = std::env::temp_dir().join(format!("manim-editor-root-test-dev-{}", std::process::id()));
        let repo = temp.join("repo");
        let exe_dir = repo.join("src-tauri/target/debug");
        std::fs::create_dir_all(&exe_dir).unwrap();
        std::fs::create_dir_all(repo.join(".venv")).unwrap();
        assert_eq!(root_from_exe(&exe_dir.join("manim-editor.exe")), Some(repo.clone()));
        std::fs::remove_dir_all(&temp).unwrap();
    }
    #[test]
    fn root_from_exe_finds_neither_layout_when_no_venv_exists() {
        let temp = std::env::temp_dir().join(format!("manim-editor-root-test-none-{}", std::process::id()));
        std::fs::create_dir_all(&temp).unwrap();
        assert_eq!(root_from_exe(&temp.join("manim-editor.exe")), None);
        std::fs::remove_dir_all(&temp).unwrap();
    }
    #[test]
    fn stderr_progress_lines_are_events_and_every_other_line_explains_a_failure() {
        let event = progress_event(r#"{"event": "progress", "phase": "rendering", "fraction": 0.5}"#).unwrap();
        assert_eq!(event["fraction"], 0.5);
        assert!(progress_event("LaTeX error: Missing } inserted.").is_none());
        assert!(progress_event(r#"{"event": "log"}"#).is_none());
        assert!(progress_event("{not json").is_none());
    }
    #[test]
    fn an_exported_video_is_named_after_its_project() {
        assert_eq!(video_file_name(&json!({"name": "Parabola: x^2 / 2"}), "mov"), "Parabola x2  2.mov");
        assert_eq!(video_file_name(&json!({"name": "///"}), "mp4"), "scene.mp4");
        assert_eq!(video_file_name(&Value::Null, "gif"), "scene.gif");
    }
    #[test]
    fn a_chosen_document_is_saved_again_without_a_dialog() {
        let chosen = std::env::temp_dir().join("manim-editor-chosen.json");
        DOCUMENTS.lock().unwrap().push(chosen.clone());
        assert_eq!(document_path("save", Some(chosen.clone())), Some(chosen));
    }
    #[test]
    fn a_recent_project_opens_without_a_dialog_and_saves_in_place_afterwards() {
        let _turn = BRIDGE.lock().unwrap_or_else(|poison| poison.into_inner());
        let recent = project_root().join("examples/equation.json");
        let result = perform_action("openRecent", Value::Null, Some(recent.clone()), None).unwrap();
        assert_eq!(result["project"]["name"], "First equation");
        assert_eq!(PathBuf::from(result["path"].as_str().unwrap()), recent);
        assert_eq!(document_path("save", Some(recent.clone())), Some(recent));
    }
    #[test]
    fn a_recent_project_must_still_be_a_json_file_on_disk() {
        let missing = std::env::temp_dir().join("manim-editor-missing-project.json");
        assert!(perform_action("openRecent", Value::Null, Some(missing), None).unwrap_err().contains("moved"));
        assert!(perform_action("openRecent", Value::Null, Some(project_root().join("README.md")), None).is_err());
        assert!(perform_action("openRecent", Value::Null, None, None).is_err());
    }
    #[test]
    fn cancelling_stops_a_running_render_and_its_children() {
        let _turn = BRIDGE.lock().unwrap_or_else(|poison| poison.into_inner());
        let project: Value = serde_json::from_str(&std::fs::read_to_string(project_root().join("examples/shape-motion.json")).unwrap()).unwrap();
        let worker = std::thread::spawn(move || execute_bridge(json!({"operation": "render", "project": project})));
        let deadline = Instant::now() + Duration::from_secs(20);
        while CHILD.lock().unwrap().is_none() && Instant::now() < deadline { std::thread::sleep(Duration::from_millis(50)); }
        std::thread::sleep(Duration::from_secs(2));
        let started = Instant::now();
        assert!(cancel_running());
        assert!(worker.join().unwrap().is_err());
        assert!(started.elapsed() < Duration::from_secs(10));
        assert!(CHILD.lock().unwrap().is_none());
        assert!(!cancel_running());
        CANCELLED.store(false, Ordering::Release);
    }
    #[test]
    fn a_video_export_renders_the_chosen_options_and_publishes_the_file() {
        let _turn = BRIDGE.lock().unwrap_or_else(|poison| poison.into_inner());
        let project: Value = serde_json::from_str(&std::fs::read_to_string(project_root().join("examples/equation.json")).unwrap()).unwrap();
        let destination = std::env::temp_dir().join(format!("manim-editor-export-{}.mov", std::process::id()));
        let options = json!({"resolution": "480p", "fps": 30, "format": "mov", "transparent": true});
        let result = execute_bridge(json!({"operation": "exportVideo", "project": project, "path": destination, "options": options})).unwrap();
        assert_eq!(PathBuf::from(result["path"].as_str().unwrap()), destination);
        assert!(std::fs::metadata(&destination).unwrap().len() > 0);
        std::fs::remove_file(&destination).unwrap();
        let refused = execute_bridge(json!({"operation": "exportVideo", "project": project, "path": destination,
            "options": {"format": "mp4", "transparent": true}}));
        assert!(refused.unwrap_err().contains("transparent background needs WebM or MOV"));
        assert!(!destination.exists());
    }
    #[test]
    fn bridge_renders_real_video() {
        let _turn = BRIDGE.lock().unwrap_or_else(|poison| poison.into_inner());
        let project: Value = serde_json::from_str(&std::fs::read_to_string(project_root().join("examples/equation.json")).unwrap()).unwrap();
        *PROGRESS.lock().unwrap() = None;
        let result = execute_bridge(json!({"operation": "render", "project": project})).unwrap();
        assert!(PathBuf::from(result["path"].as_str().unwrap()).is_file());
        // The bridge reported where Manim was while it rendered.
        assert!(PROGRESS.lock().unwrap().as_ref().is_some_and(|event| event["event"] == "progress"));
    }
}
