import json
import os
import threading
import sys

CONFIG_FILE = 'config.json'
DEFAULT_CONFIG = {
    "SECRET_KEY": "your_default_secret_key",
    "DEBUG": True,
    "HOST": "127.0.0.1",
    "PORT": 5000,
    "DATA_DIR": "__PLACEHOLDER__",
    "CHATBOT": {
        "DEFAULT_IMAGE": "{DATA_DIR}/images/default_character.png",
        "UPLOAD_FOLDER_RELATIVE": "uploads",
        "INIT_CONFIG": {
            "base_url": None,
            "api_key": None,
            "memory_db_path": "{DATA_DIR}/memory.db",
            "role_graph_path": "{DATA_DIR}/graph_data.json"
        },
        "CHAT_CONFIG": {
            "summarizing_prompt":
          [{"role": "system", "content": "filled with list of messages."}],
            "stm_search_range": [0.7, None],
            "stm_recall_context": True,
            "stm_max_fetch_count": 3,
            "ltm_search_range": [0.7, None],
            "ltm_recall_context": True,
            "ltm_max_fetch_count": 6,
            "attr_contradict_threshold": 0.58,
            "attr_entailment_threshold": 0.7,
            "recall_attr_threshold": 0.65,
            "recall_style_threshold": 0.7
        }
    },
    "MEMORY_EDITOR": {
        "DB_PATH": "{DATA_DIR}", # Base path for memory_editor DB
        "DB_NAME": "memory.db" # DB filename for memory_editor
    },
    "ROLE_GRAPH": {
        "DATA_PATH": "{DATA_DIR}/graph_data.json", # Path for role_graph data
        "OUTPUT_DIR": "{DATA_DIR}/queries"
    },
    "STANDARD_QUERY": {
        "GRAPH_PATH": "{DATA_DIR}/graph_data.json", # Path to role_graph data
        "OUTPUT_DIR": "{DATA_DIR}/queries"      # Path for standard_query data
    },
    "STANDARD_ANSWER": {
        "GRAPH_PATH": "{DATA_DIR}/graph_data.json", # Path to role_graph data
        "OUTPUT_DIR": "{DATA_DIR}/qna_data"       # Path for standard_answer data
    }
}

_config = None
_lock = threading.RLock()

def _resolve_paths(config_dict, data_dir):
    """Recursively replaces {DATA_DIR} placeholder."""
    resolved_dict = {}
    for key, value in config_dict.items():
        if isinstance(value, dict):
            resolved_dict[key] = _resolve_paths(value, data_dir)
        elif isinstance(value, str):
            resolved_dict[key] = value.replace("{DATA_DIR}", data_dir)
        else:
            resolved_dict[key] = value
    return resolved_dict

def load_config(config_path=None):
    """Loads configuration from JSON file, creating it with defaults if it doesn't exist."""
    global _config
    with _lock:
        if _config is not None:
            return _config

        if not config_path:
            print(f"WARNING: config_path not provided to load_config. This may lead to unexpected behavior.")
            config_path = os.path.join(os.path.dirname(__file__), CONFIG_FILE)
        if os.path.exists(config_path):
            try:
                with open(config_path, 'r', encoding='utf-8') as f:
                    loaded_config = json.load(f)
                print(f"Loaded configuration from {config_path}")
            except json.JSONDecodeError:
                print(f"Error decoding {config_path}. Using default configuration.")
                loaded_config = DEFAULT_CONFIG
            except Exception as e:
                print(f"Error loading {config_path}: {e}. Using default configuration.")
                loaded_config = DEFAULT_CONFIG
        else:
            print(f"{config_path} not found. Creating with default configuration.")


        def update_dicts(target, source):
            for key, value in source.items():
                if isinstance(value, dict) and key in target and isinstance(target[key], dict):
                    update_dicts(target[key], value)
                else:
                    target[key] = value # Take the value from source (defaults) if missing in target (loaded)

        merged = DEFAULT_CONFIG.copy() # Start with defaults
        update_dicts(merged, loaded_config) # Overlay loaded values onto defaults

        # Resolve {DATA_DIR} placeholders
        config_file_directory = os.path.dirname(os.path.abspath(config_path))
        if "DATA_DIR" in loaded_config:
            data_dir_from_config = loaded_config["DATA_DIR"]
            if data_dir_from_config == "__PLACEHOLDER__":
                resolved_data_dir = config_file_directory
            elif os.path.isabs(data_dir_from_config):
                resolved_data_dir = data_dir_from_config
            else:
                resolved_data_dir = os.path.abspath(os.path.join(config_file_directory, data_dir_from_config))
        else:
            resolved_data_dir = config_file_directory

        merged["DATA_DIR"] = resolved_data_dir

        _config = _resolve_paths(merged, resolved_data_dir)

        # Ensure data directories exist
        os.makedirs(_config["DATA_DIR"], exist_ok=True)
        if "STANDARD_QUERY" in _config and "OUTPUT_DIR" in _config["STANDARD_QUERY"]:
            os.makedirs(_config["STANDARD_QUERY"]["OUTPUT_DIR"], exist_ok=True)
        if "STANDARD_ANSWER" in _config and "OUTPUT_DIR" in _config["STANDARD_ANSWER"]:
            os.makedirs(_config["STANDARD_ANSWER"]["OUTPUT_DIR"], exist_ok=True)
        if "CHATBOT" in _config and "UPLOAD_FOLDER_RELATIVE" in _config["CHATBOT"]:
             chatbot_upload_abs_path = os.path.join(_config["DATA_DIR"], _config["CHATBOT"]["UPLOAD_FOLDER_RELATIVE"])
             os.makedirs(chatbot_upload_abs_path, exist_ok=True)
             _config["CHATBOT"]["UPLOAD_FOLDER_ABSOLUTE"] = chatbot_upload_abs_path

        return _config

def get_config(config_path = None):
    """Returns the current configuration."""
    if _config is None:
        load_config(config_path)
    return _config

def save_config(new_config_data, config_path=None):
    """Saves the updated configuration data back to the JSON file."""
    global _config
    with _lock:
        if not config_path:
            print("ERROR: config_path not provided to save_config.")
            return False, "Config path not specified for saving."
        try:
            config_file_dir = os.path.dirname(os.path.abspath(config_path))
            portable_config = json.loads(json.dumps(new_config_data))
            if portable_config.get("DATA_DIR") == config_file_dir:
                portable_config["DATA_DIR"] = "."

            data_dir = new_config_data.get("DATA_DIR", "")
            def replace_with_placeholder(config_dict, data_dir_abs):
                portable_dict = {}
                for key, value in config_dict.items():
                    if isinstance(value, dict):
                        portable_dict[key] = replace_with_placeholder(value, data_dir_abs)
                    elif isinstance(value, str) and value.startswith(data_dir_abs) and key != "DATA_DIR":
                        portable_dict[key] = value.replace(data_dir_abs, "{DATA_DIR}", 1)
                    else:
                        portable_dict[key] = value
                return portable_dict

            if data_dir and os.path.isabs(data_dir):
                 portable_config = replace_with_placeholder(portable_config, data_dir)

            with open(config_path, 'w', encoding='utf-8') as f:
                json.dump(portable_config, f, ensure_ascii=False, indent=2)
            print(f"Configuration saved to {config_path}")
            sys.stdout.flush()
            _config = None
            load_config(config_path)
            return True, None
        except Exception as e:
            print(f"Error saving config to {config_path}: {e}")
            return False, str(e)