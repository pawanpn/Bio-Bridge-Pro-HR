#![recursion_limit = "512"]
pub mod db;
pub mod crud;
pub mod hardware;
pub mod models;
pub mod errors;
pub mod security;
pub mod sync_service;
pub mod commands;

use std::sync::Mutex;
use tauri::Manager;
use crate::db::init_db;

pub struct AppState {
    pub db: Mutex<Option<rusqlite::Connection>>,
    pub supabase_config: Mutex<Option<crate::sync_service::SyncConfig>>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let app_dir = app.path().app_data_dir().expect("Failed to get app data dir");
            let conn = init_db(&app_dir).expect("Failed to initialize database");
            
            let state = AppState {
                db: Mutex::new(Some(conn)),
                supabase_config: Mutex::new(None),
            };
            app.manage(state);

            let state_handle = app.state::<AppState>();
            let state_clone = state_handle.inner().clone();

            // Automated Background Sync Loop (runs every 60 seconds)
            tokio::spawn(async move {
                let mut interval = tokio::time::interval(std::time::Duration::from_secs(60));
                loop {
                    interval.tick().await;
                    // Attempt to sync pending changes to Supabase
                    let _ = crate::sync_service::sync_to_supabase(tauri::State::from(&state_clone)).await;
                }
            });

            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            // From commands.rs (Hardware & General)
            commands::list_all_devices,
            commands::test_device_connection,
            commands::add_device,
            commands::save_device_config,
            commands::delete_device,
            commands::set_default_device,
            commands::sync_device_logs,
            commands::pull_all_logs,
            commands::list_branches,
            commands::list_gates,
            commands::list_employees_for_select,
            commands::add_manual_attendance,
            commands::import_csv_attendance,
            commands::get_system_configs,
            commands::get_all_system_configs,
            commands::save_system_config,
            commands::delete_system_config,
            commands::scan_network,
            
            // From crud.rs (ERP Modules)
            crud::create_item,
            crud::list_items,
            crud::update_item,
            crud::delete_item,
            crud::update_stock,
            crud::get_inventory_stats,
            crud::create_employee,
            crud::get_employee,
            crud::list_employees,
            crud::update_employee,
            crud::delete_employee,
            crud::create_leave_request,
            crud::list_leave_requests,
            crud::update_leave_status,
            crud::get_attendance_logs,
            crud::create_salary_structure,
            crud::get_salary_structure,
            crud::create_invoice,
            crud::list_invoices,
            crud::create_project,
            crud::list_projects,
            crud::update_project,
            crud::delete_project,
            crud::get_project_stats,
            crud::create_task,
            crud::create_lead,
            crud::list_leads,
            crud::update_lead,
            crud::delete_lead,
            crud::get_crm_stats,
            crud::create_asset,
            crud::list_assets,
            crud::update_asset,
            crud::delete_asset,
            crud::get_asset_stats,
            
            // From sync_service.rs (Cloud Sync)
            sync_service::initialize_supabase_sync,
            sync_service::sync_to_supabase,
            sync_service::pull_from_supabase,
            sync_service::resolve_sync_conflict,
            sync_service::get_sync_stats,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
