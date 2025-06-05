import os
import sys
from flask import Flask, jsonify, request, send_from_directory, abort, current_app
from flask_cors import CORS
import argparse
import importlib.util
import threading
import traceback
import time
import webbrowser
import subprocess
import platform
import logging
import logging.handlers
import json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from config_manager import get_config, save_config, DEFAULT_CONFIG, load_config

logger = logging.getLogger(__name__)

def setup_logging():
    """Configures logging to file and console."""
    log_dir = "logs"
    os.makedirs(log_dir, exist_ok=True)
    log_file_path = os.path.join(log_dir, "app.log")

    logger.setLevel(logging.INFO)
    file_handler = logging.handlers.RotatingFileHandler(
        log_file_path, maxBytes=2*1024*1024, backupCount=5, encoding='utf-8'
    )
    file_formatter = logging.Formatter('%(asctime)s - %(levelname)s - [%(threadName)s:%(thread)d] - %(module)s.%(funcName)s:%(lineno)d - %(message)s')
    file_handler.setFormatter(file_formatter)
    logger.addHandler(file_handler)
    console_handler = logging.StreamHandler(sys.stdout)
    console_formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
    console_handler.setFormatter(console_formatter)
    logger.addHandler(console_handler)
    logger.info("Logging initialized.")

def pause_and_exit(exit_code=1, message="An error occurred. See messages above."):
    logger.info(f"--------------------------------------------------------------------------")
    if exit_code == 0:
        logger.info(f"INFO: {message if message else 'Application is exiting normally.'}")
        logger.info(f"The application will now close (exit code: {exit_code}).")
        sys.exit(exit_code)  # Normal exit
    else:
        logger.error(f"ERROR: {message} (Reported exit code: {exit_code})")
        logger.error(f"The application will continue running. Review logs for details. Functionality may be affected.")


def get_project_root_path():
    if getattr(sys, 'frozen', False):
        return os.path.dirname(sys.executable)
    else:
        return os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))

PROJECT_ROOT_PATH = get_project_root_path()
DEFAULT_CHARACTER_DIR_NAME = "meguru"
CHARACTERS_BASE_DIR_NAME = "Characters"
DEFAULT_CHARACTER_PATH = os.path.join(PROJECT_ROOT_PATH, CHARACTERS_BASE_DIR_NAME, DEFAULT_CHARACTER_DIR_NAME)

# --- Flask App Initialization ---
if getattr(sys, 'frozen', False):
    _executable_dir = os.path.dirname(sys.executable)
    FRONTEND_DIR = os.path.join(_executable_dir, 'core', 'chatbot_app', 'frontend', 'build')
else:
    FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'frontend', 'build'))

if not os.path.exists(FRONTEND_DIR):
    logger.critical(f"!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
    logger.critical(f"FATAL ERROR: Frontend directory not found at: {FRONTEND_DIR}")
    logger.critical(f"Ensure the frontend build output is placed correctly relative to the executable.")
    logger.critical(f"The application will attempt to start, but the frontend will be unavailable.")
    logger.critical(f"!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
    # sys.exit(1)

app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path='/')

app.config['CHATBOT_STATUS'] = 'uninitialized'
app.config['CHATBOT_STATUS_LOCK'] = threading.Lock()
app.config['SHARED_CHATBOT_INSTANCE'] = None
app.config['SHARED_MEMORY_SYSTEM'] = None
app.config['APP_CONFIG'] = {}
app.config['CONFIG_PATH'] = None

# --- Configuration Management API ---
@app.route('/api/config', methods=['GET'])
def get_app_config():
    """Returns the current (non-sensitive) configuration."""
    current_config = get_config(app.config.get('CONFIG_PATH')) # Use config_path stored in app.config
    safe_config = {k: v for k, v in current_config.items() if k not in ['SECRET_KEY']}
    # if 'CHATBOT' in safe_config and 'INIT_CONFIG' in safe_config['CHATBOT']:
    #     safe_config['CHATBOT']['INIT_CONFIG'] = {
    #         k: v for k, v in safe_config['CHATBOT']['INIT_CONFIG'].items()
    #         if k != 'llm_api_key'
    #     }
    return jsonify(safe_config)

@app.route('/api/config', methods=['PUT'])
def update_app_config():
    """Updates the configuration file."""
    request_received_time = time.time()
    logger.info(f"PUT /api/config: Request received. Attempting to acquire CHATBOT_STATUS_LOCK.")
    lock = current_app.config['CHATBOT_STATUS_LOCK']
    previous_status_before_config_edit = None
    try:
        with lock:
            lock_acquired_time = time.time()
            logger.info(f"PUT /api/config: CHATBOT_STATUS_LOCK acquired in {lock_acquired_time - request_received_time:.4f} seconds.")
            current_status = current_app.config.get('CHATBOT_STATUS')
            if current_status not in ['uninitialized',
                                      'closed', 'config_editing', 'active',
                                      'role_graph_editing', 'standard_query_editing',
                                      'standard_answer_editing', 'memory_editing']:
                logger.warning(f"PUT /api/config: Status '{current_status}' prevents config update. Releasing lock and returning 403.")
                return jsonify({"error": f"Configuration cannot be updated. System status is '{current_status}'. Please ensure other operations are completed and chatbot/editor is closed."}), 403

            previous_status_before_config_edit = current_status
            current_app.config['CHATBOT_STATUS'] = 'config_editing'
            logger.info(f"Status changed to 'config_editing' for configuration update. Previous status: {previous_status_before_config_edit}")

    except Exception as e_lock_related:
        logger.error(f"PUT /api/config: Exception during initial lock acquisition or status check: {e_lock_related}", exc_info=True)
        return jsonify({"error": "Failed during initial lock processing"}), 500

    try:
        if not request.is_json:
            with lock:
                if current_app.config.get(
                        'CHATBOT_STATUS') == 'config_editing':
                    current_app.config[
                        'CHATBOT_STATUS'] = previous_status_before_config_edit if previous_status_before_config_edit is not None else 'closed'
            return jsonify({"error": "Request must be JSON"}), 400

        new_data = request.get_json()
        if not isinstance(new_data, dict):
            with lock:
                if current_app.config.get('CHATBOT_STATUS') == 'config_editing':
                    current_app.config[
                        'CHATBOT_STATUS'] = previous_status_before_config_edit if previous_status_before_config_edit is not None else 'closed'
            return jsonify({"error": "Invalid configuration format"}), 400

        logger.info(f"PUT /api/config: JSON and data format validated. Proceeding to merge config.")
        current_config = get_config(app.config.get('CONFIG_PATH'))

        def merge_update(target, source):
            for key, value in source.items():
                if isinstance(value, dict) and key in target and isinstance(target[key], dict):
                    merge_update(target[key], value)
                else:
                    target[key] = value

        updated_config = current_config.copy()
        merge_update(updated_config, new_data)
        logger.info(f"PUT /api/config: Config merged. Attempting to save.")
        save_started_time = time.time()
        success, error_msg = save_config(updated_config,config_path = app.config.get('CONFIG_PATH'))
        success_update_llm = True
        shared_chatbot_instance = current_app.config.get('SHARED_CHATBOT_INSTANCE')
        if shared_chatbot_instance is not None:
            try:
                success_update_llm = shared_chatbot_instance.update_llm_config(**updated_config.get("CHATBOT", {}).get("INIT_CONFIG", {}))
            except:
                success_update_llm = False

        logger.info(f"PUT /api/config: save_config call completed in {time.time() - save_started_time:.4f} seconds. Success: {success}, LLM update success: {success_update_llm}")
        if success and success_update_llm:
            response_payload = {
                "message": "Configuration updated successfully. A restart or re-initialization may be required for some changes."}
            with lock:
                current_app.config['CHATBOT_STATUS'] = 'closed'
                logger.info(f"Configuration file saved. Status set to 'closed'. Will now attempt to reload APP_CONFIG internally.")
            client_response = jsonify(response_payload)

            reload_started_time = time.time()
            try:
                logger.info(f"Attempting to reload APP_CONFIG from disk...")
                current_app.config['APP_CONFIG'] = get_config(current_app.config.get('CONFIG_PATH'))
                logger.info(f"APP_CONFIG reloaded successfully into live application config in {time.time() - reload_started_time:.4f} seconds.")
            except Exception as e_reload:
                logger.critical(f"Failed to reload APP_CONFIG internally after successful save: {e_reload}", exc_info=True)
            logger.info(f"PUT /api/config: Sending success response. Total request time: {time.time() - request_received_time:.4f} seconds.")
            return client_response, 200
        else:
            error_detail = error_msg if not success else "LLM configuration update failed."
            with lock:
                if current_app.config.get('CHATBOT_STATUS') == 'config_editing':
                    current_app.config[
                        'CHATBOT_STATUS'] = previous_status_before_config_edit if previous_status_before_config_edit is not None else 'closed'
                    logger.error(f"Configuration save/LLM update failed. Status reverted to '{previous_status_before_config_edit if previous_status_before_config_edit is not None else 'closed'}'. Error: {error_detail}")
            logger.error(f"PUT /api/config: Sending save failure response. Total request time: {time.time() - request_received_time:.4f} seconds.")
            return jsonify({"error": f"Failed to save configuration: {error_msg}"}), 500

    except Exception as e_config_update:
        logger.error(f"PUT /api/config: Unhandled exception during main config update process: {e_config_update}",
                     exc_info=True)
        try:
            with lock:
                if current_app.config.get('CHATBOT_STATUS') == 'config_editing':  # Check if we were in 'config_editing'
                    current_app.config[
                        'CHATBOT_STATUS'] = previous_status_before_config_edit if previous_status_before_config_edit is not None else 'closed'
                    logger.warning(f"Status reverted to '{previous_status_before_config_edit if previous_status_before_config_edit is not None else 'closed'}' due to exception during config update.")
        except Exception as e_revert:
            logger.error(f"Exception during status revert attempt: {e_revert}", exc_info=True)
        logger.error(f"PUT /api/config: Sending general error response. Total request time: {time.time() - request_received_time:.4f} seconds.")
        return jsonify(
            {"error": f"An unexpected error occurred during configuration update: {str(e_config_update)}"}), 500


@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_react_app(path):
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    else:
        if os.path.exists(os.path.join(app.static_folder, 'index.html')):
             return send_from_directory(app.static_folder, 'index.html')
        else:
            logger.error(f"Frontend 'index.html' not found in static folder: {app.static_folder}")
            abort(404, "index.html not found in build directory.")


def run_flask_app():
    parser = argparse.ArgumentParser(description="Chatbot Backend Application")
    parser.add_argument(
        "--character-dir",
        help=(
            f"Relative path to the character data directory (e.g., {CHARACTERS_BASE_DIR_NAME}/{DEFAULT_CHARACTER_DIR_NAME}) "
            f"from the application root ({PROJECT_ROOT_PATH}). Defaults to using '{DEFAULT_CHARACTER_DIR_NAME}'.")
    )
    args = parser.parse_args()

    selected_character_relative_path = args.character_dir
    if selected_character_relative_path:
        if not selected_character_relative_path.startswith(CHARACTERS_BASE_DIR_NAME + os.sep):
            app.config['CHARACTER_DIR_PATH'] = os.path.join(PROJECT_ROOT_PATH, CHARACTERS_BASE_DIR_NAME,
                                                            selected_character_relative_path)
        else:
            app.config['CHARACTER_DIR_PATH'] = os.path.join(PROJECT_ROOT_PATH, selected_character_relative_path)
    else:
        app.config['CHARACTER_DIR_PATH'] = DEFAULT_CHARACTER_PATH

    app.config['CHARACTER_DIR_PATH'] = os.path.abspath(app.config['CHARACTER_DIR_PATH'])
    logger.info(f"Using character directory: {app.config['CHARACTER_DIR_PATH']}")
    config_file_name = "config.json"
    feature_function_file_name = "feature_function.py"

    app.config['CONFIG_PATH'] = os.path.join(app.config['CHARACTER_DIR_PATH'], config_file_name)
    if not os.path.exists(app.config['CONFIG_PATH']):
        logger.error(f"'{config_file_name}' not found in character directory: {app.config['CHARACTER_DIR_PATH']}")
        if app.config['CHARACTER_DIR_PATH'] == DEFAULT_CHARACTER_PATH:
            logger.info(f"Attempting to create default '{config_file_name}' in {DEFAULT_CHARACTER_PATH}")
            os.makedirs(DEFAULT_CHARACTER_PATH, exist_ok=True)
            try:
                char_default_config = DEFAULT_CONFIG.copy()
                char_default_config["DATA_DIR"] = "__PLACEHOLDER__"
                path_keys_to_update = {
                    ("CHATBOT", "INIT_CONFIG", "memory_db_path"): "{DATA_DIR}/memory.db",
                    ("CHATBOT", "INIT_CONFIG", "role_graph_path"): "{DATA_DIR}/graph_data.json",
                    ("CHATBOT", "DEFAULT_IMAGE"): "/images/default_img.png",
                    ("MEMORY_EDITOR", "DB_PATH"): "{DATA_DIR}",
                    ("ROLE_GRAPH", "DATA_PATH"): "{DATA_DIR}/graph_data.json",
                    ("STANDARD_QUERY", "GRAPH_PATH"): "{DATA_DIR}/graph_data.json",
                    ("STANDARD_QUERY", "OUTPUT_DIR"): "{DATA_DIR}/queries",
                    ("STANDARD_ANSWER", "GRAPH_PATH"): "{DATA_DIR}/graph_data.json",
                    ("STANDARD_ANSWER", "OUTPUT_DIR"): "{DATA_DIR}/qna_data",
                }
                for keys, new_value_template in path_keys_to_update.items():
                    temp_dict = char_default_config
                    for k_idx, key_part in enumerate(keys[:-1]):
                        temp_dict = temp_dict.setdefault(key_part, {})
                    temp_dict[keys[-1]] = new_value_template

                with open(app.config['CONFIG_PATH'], 'w', encoding='utf-8') as f:
                    json.dump(char_default_config, f, ensure_ascii=False, indent=2)
                logger.info(f"Created default '{config_file_name}' with DATA_DIR placeholder at {app.config['CONFIG_PATH']}")
            except Exception as e:
                logger.error(f"Could not create default '{config_file_name}': {e}", exc_info=True)
                pause_and_exit(1, f"Failed to create default {config_file_name}.")
                # sys.exit(1)
        else:
            logger.error(f"Configuration file '{config_file_name}' missing in {app.config['CHARACTER_DIR_PATH']}.")
            pause_and_exit(1,
                           f"Configuration file '{config_file_name}' missing. Application may not function correctly.")
            # sys.exit(1)

    try:
        config = load_config(app.config['CONFIG_PATH'])
        app.config['APP_CONFIG'] = config
    except Exception as e_load_cfg:
        logger.error(f"Failed to load configuration from {app.config['CONFIG_PATH']}: {e_load_cfg}", exc_info=True)
        app.config['APP_CONFIG'] = DEFAULT_CONFIG.copy()
        logger.warning(f"Falling back to a default internal configuration due to load failure. Critical functionalities might be affected.")
        config = app.config['APP_CONFIG']

    override_path = os.path.join(app.config['CHARACTER_DIR_PATH'], feature_function_file_name)
    if not os.path.exists(override_path):
        logger.error(f"'{feature_function_file_name}' not found in character dir: {app.config['CHARACTER_DIR_PATH']}")
        pause_and_exit(1,f"Feature function file '{feature_function_file_name}' not found. Application may not function correctly.")
        sys.exit(1)

    logger.info(f"Attempting to load feature functions from: {override_path}")
    try:
        spec = importlib.util.spec_from_file_location("user_override", override_path)
        if spec is None: raise ImportError(f"Could not get spec for module at {override_path}")
        user_override_module = importlib.util.module_from_spec(spec)
        sys.modules['chatbot_override'] = user_override_module
        spec.loader.exec_module(user_override_module)
        logger.info(f"Successfully loaded and replaced 'chatbot_override' with functions from '{override_path}'.")
    except Exception as e_override:
        logger.error(f"Failed to apply overrides from '{override_path}': {e_override}", exc_info=True)
        pause_and_exit(1,f"Failed to load feature functions from '{override_path}'. Application may not function correctly.")
        sys.exit(1)

    should_initialize_globally = not config.get('DEBUG', False) \
                                 or os.environ.get("WERKZEUG_RUN_MAIN") == "true"

    if should_initialize_globally:
        logger.info("Attempting global RPCharacterChatbot initialization...")
        try:
            if 'chatbot_override' not in sys.modules:
                logger.warning("'chatbot_override' module not found in sys.modules. Chatbot initialization will likely fail if it relies on it.")
            from chatbot_override import init_chatbot
            chatbot_init_cfg = config.get('CHATBOT', {}).get('INIT_CONFIG', {})
            if not chatbot_init_cfg:
                raise ValueError("Chatbot 'INIT_CONFIG' is missing in the application configuration.")

            globally_initialized_chatbot = init_chatbot(**chatbot_init_cfg)
            if not hasattr(globally_initialized_chatbot, 'memory_system'):
                raise AttributeError("Chatbot instance from init_chatbot() lacks 'memory_system'.")
            if getattr(globally_initialized_chatbot, 'memory_system') is None:
                raise ValueError("Chatbot's 'memory_system' is None.")

            app.config['SHARED_CHATBOT_INSTANCE'] = globally_initialized_chatbot
            app.config['SHARED_MEMORY_SYSTEM'] = globally_initialized_chatbot.memory_system
            app.config['CHATBOT_STATUS'] = 'closed'
            print("INFO: Global RPCharacterChatbot and MemorySystem initialized successfully. Status: closed.")
        except ImportError:
            logger.critical(f"FATAL ERROR: Could not import 'init_chatbot' from feature functions (likely '{feature_function_file_name}' was not loaded or is missing the function). Chatbot cannot be initialized.", exc_info=True)
            app.config['CHATBOT_STATUS'] = 'init_failed'
            pause_and_exit(1, "Critical error importing chatbot initialization function.")
        except NotImplementedError as nie:
            logger.critical(
                f"FATAL ERROR: A required function in '{feature_function_file_name}' is not implemented: {nie}",
                exc_info=True)
            app.config['CHATBOT_STATUS'] = 'init_failed'
            pause_and_exit(1,f"A required function in '{feature_function_file_name}' is not implemented. Chatbot initialization failed.")
        except Exception as e_global_init:
            logger.critical(f"FATAL ERROR: Global RPCharacterChatbot initialization failed: {e_global_init}", exc_info=True)
            app.config['CHATBOT_STATUS'] = 'init_failed'
            pause_and_exit(1, "Global RPCharacterChatbot initialization failed.")
    else:
        logger.info("Skipping global RPCharacterChatbot initialization (likely Flask reloader). Status: 'uninitialized'.")
        app.config['CHATBOT_STATUS'] = 'active'

    app.config['SECRET_KEY'] = config.get('SECRET_KEY', 'a_very_secure_default_fallback_key')
    app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    # Import and Register Blueprints (AFTER overrides and config are set)
    from chatbot.bp import create_chatbot_blueprint
    from memory_editor.bp import create_memory_editor_blueprint
    from role_graph.bp import create_role_graph_blueprint
    from standard_query.bp import create_standard_query_blueprint
    from standard_answer.bp import create_standard_answer_blueprint

    app.register_blueprint(create_chatbot_blueprint(config.get('CHATBOT', {})), url_prefix='/api/chatbot')
    app.register_blueprint(create_memory_editor_blueprint(config.get('MEMORY_EDITOR', {})),
                           url_prefix='/api/memory_editor')
    app.register_blueprint(create_role_graph_blueprint(config.get('ROLE_GRAPH', {})), url_prefix='/api/role_graph')
    app.register_blueprint(create_standard_query_blueprint(config.get('STANDARD_QUERY', {})),
                           url_prefix='/api/standard_query')
    app.register_blueprint(create_standard_answer_blueprint(config.get('STANDARD_ANSWER', {})),
                           url_prefix='/api/standard_answer')

    logger.info(f"Starting Flask server on http://{config.get('HOST')}:{config.get('PORT')}")
    logger.info(f"Serving frontend from: {app.static_folder}")

    data_dir_to_log = config.get('DATA_DIR', 'UNKNOWN (config loading issue)')
    if isinstance(data_dir_to_log, str) and data_dir_to_log == "__PLACEHOLDER__":
        data_dir_to_log = app.config['CHARACTER_DIR_PATH']
        logger.warning(f"DATA_DIR was placeholder, using CHARACTER_DIR_PATH as likely data directory: {data_dir_to_log}")
    logger.info(f"Using data (character) directory: {data_dir_to_log}")
    logger.info(f"Debug mode: {config.get('DEBUG')}")

    debug = config.get('DEBUG', False)
    use_flask_reloader = not getattr(sys, 'frozen', False) and debug
    logger.info("Flask app setup complete. Starting server...")

    # Function to open browser and return process if available
    def open_browser():
        time.sleep(1)  # Give server a moment to start
        system = platform.system()
        host = config.get("HOST", "127.0.0.1")
        port = config.get("PORT", 5000)
        url = f'http://{host}:{port}'

        cmd_map = {
            'Windows': ['cmd', '/c', 'start', '', url],
            'Linux': ['xdg-open', url],
            'Darwin': ['open', url]
        }

        browser_process = None
        try:
            if not os.path.exists(FRONTEND_DIR) or not os.path.exists(os.path.join(FRONTEND_DIR, 'index.html')):
                logger.warning(f"Frontend not found at {FRONTEND_DIR}. Skipping automatic browser opening.")
                logger.info(f"Please access the application manually at {url} if the backend is running correctly.")
            elif system in cmd_map:
                logger.info(f"Attempting to open browser at {url} using system command: {cmd_map[system]}")
                # On Windows, use shell=True for 'start' command to work properly
                shell = (system == 'Windows')
                browser_process = subprocess.Popen(
                    cmd_map[system],
                    shell=shell,
                    creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if system == 'Windows' else 0
                )
            else:
                logger.info(
                    f"Unsupported OS for direct browser command: {system}. Opening browser using webbrowser module.")
                logger.info(f"Please access the application manually at {url} if it doesn't open.")
                webbrowser.open(url)
        except Exception as e_browser:
            logger.error(f"Failed to open web browser automatically: {e_browser}", exc_info=True)
            logger.info(f"Please open your web browser and navigate to {url} manually.")
        return browser_process

    browser_process = None
    if should_initialize_globally:
        try:
            browser_process = open_browser()
        except Exception as e:
            logger.error(f"Browser opening failed: {e}", exc_info=True)
    else:
        logger.info("Skipping browser open (likely reloader process)")

    # Run Flask app in main thread to avoid signal issues
    try:
        app.run(debug=debug,
                host=config.get('HOST'),
                port=config.get('PORT'),
                use_reloader=use_flask_reloader)
    except KeyboardInterrupt:
        logger.info("KeyboardInterrupt received. Shutting down application...")
        pause_and_exit(0, "Application shut down by user (KeyboardInterrupt).")
    except Exception as e_flask_run:
        logger.critical(f"Flask app.run failed: {e_flask_run}", exc_info=True)
        pause_and_exit(1, "Flask server failed to start or crashed.")

    if browser_process and browser_process.poll() is None:
        logger.info(f"Monitoring browser process (PID: {browser_process.pid})")
        try:
            browser_process.wait()
            logger.info("Browser process has been closed. Shutting down backend.")
            pause_and_exit(0, "Application shut down after browser closed.")
        except Exception as e_wait:
            logger.error(f"Error waiting for browser process: {e_wait}", exc_info=True)
            pause_and_exit(1, f"Error during browser process monitoring: {e_wait}")
    else:
        logger.info("No browser process to monitor. Backend will run until manually stopped.")

    pause_and_exit(0, "Application shut down normally.")

if __name__ == '__main__':
    try:
        setup_logging()
    except Exception as e_logging_setup:
        print(f"CRITICAL: Logging setup failed: {e_logging_setup}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)

    try:
        run_flask_app()
    except SystemExit as e:
        if e.code == 0:
             logger.info(f"Application shut down successfully with exit code {e.code}.")
        else:
             logger.warning(f"Application exited with code: {e.code}. This might indicate an issue if not a deliberate shutdown.")
    except Exception as e:
        logger.critical("FATAL UNHANDLED EXCEPTION in main execution block (run_flask_app):", exc_info=True)
        logger.critical("The application server may have crashed or is in an unstable state. Manual intervention might be required.")
    finally:
        logger.info("Application main execution block has completed.")