import os
import uuid
import mimetypes
import traceback
from flask import Blueprint, request, jsonify, send_from_directory, abort, current_app

try:
    from chatbot_override import get_role_desc, get_image_file_path
    print("INFO: Using chatbot functions from chatbot_override.py")
except ImportError:
    print("WARNING: chatbot_override.py not found or functions not defined. Using default placeholders.")
    def get_role_desc(round, user_input, **kwargs):
        raise NotImplementedError("get_role_desc not implemented")
    def get_image_file_path(response):
        raise NotImplementedError("get_image_file_path not implemented")
except NotImplementedError as e:
    print(f"ERROR: Required function not implemented in chatbot_override.py: {e}")
    raise e

bp = Blueprint('chatbot', __name__, template_folder='templates')

current_history = []
current_round = 0
image_token_map = {}
default_character_image_path = "path/to/image"
default_character_image_token = "virtual/path/to/image"
default_background_image_token = "path/to/image"
default_background_image_path = "virtual/path/to/image"

def create_chatbot_blueprint(chatbot_config):
    """Factory function to create the chatbot blueprint."""
    global default_character_image_token, default_character_image_path
    global default_background_image_token, default_background_image_path

    print("Creating Chatbot Blueprint...")
    upload_folder_path_global = chatbot_config.get('UPLOAD_FOLDER_ABSOLUTE')
    if not upload_folder_path_global:
        print("ERROR: Chatbot UPLOAD_FOLDER_ABSOLUTE not configured!")
        base_data_dir = current_app.config['APP_CONFIG'].get('DATA_DIR', '.')
        upload_folder_path_global = os.path.join(base_data_dir, chatbot_config.get('UPLOAD_FOLDER_RELATIVE', 'uploads_char_default'))
    os.makedirs(upload_folder_path_global, exist_ok=True)
    print(f"Chatbot uploads directory configured at: {upload_folder_path_global}")

    default_character_image_path = chatbot_config.get('DEFAULT_IMAGE', '')
    default_background_image_path = chatbot_config.get('DEFAULT_BG_IMAGE', '')

    def _generate_image_token(file_path):
        """Generates a unique token for a given file path and stores the mapping."""
        global image_token_map
        if not file_path or not isinstance(file_path, str):
            print(f"Warning: Invalid file_path received by _generate_image_token: {file_path}")
            return None
        normalized_path = os.path.abspath(file_path)
        for token, path_info in image_token_map.items():
            if path_info['abs_path'] == normalized_path:
                return token

        token = str(uuid.uuid4())
        image_token_map[token] = {'abs_path': normalized_path, 'orig_path': file_path}
        print(f"Generated token {token} for path: {normalized_path}")
        return token

    default_character_image_token = _generate_image_token(default_character_image_path)
    default_background_image_token = _generate_image_token(default_background_image_path)

    print(f"Default character image token set to: {default_character_image_token}")

    def _ensure_chatbot_active():
        """Helper to check if chatbot is active and instance exists."""
        global current_history, current_round  # For resetting UI session state

        with current_app.config['CHATBOT_STATUS_LOCK']:
            current_status = current_app.config.get('CHATBOT_STATUS')
            shared_chatbot_instance = current_app.config.get('SHARED_CHATBOT_INSTANCE')

            if current_status == 'init_failed' or shared_chatbot_instance is None:
                abort(503, "Chatbot is not available due to an initialization failure. Check server logs.")

            if current_status == 'closed':
                try:
                    shared_chatbot_instance.ensure_initialized()
                    shared_chatbot_instance.start_new_session()
                    current_app.config['CHATBOT_STATUS'] = 'active'
                    print("INFO: Chatbot status was 'closed'. Transitioning to 'active' for interaction.")
                except Exception as e:
                    current_app.config['CHATBOT_STATUS'] = 'init_failed'
                    print(f"Initialization failure{e}. Check server logs.")

                current_history.clear()
                current_round = 0
            elif current_status != 'active':
                abort(503, f"Chatbot is not currently active. System status: {current_status}.")

        return shared_chatbot_instance
    # === API Routes (Copied and adapted from chatbot.txt) ===

    @bp.route('/config', methods=['GET'])
    def get_chatbot_config():
        """Returns chatbot configuration info."""
        global default_character_image_token
        global default_background_image_token
        chatbot_instance = current_app.config.get('SHARED_CHATBOT_INSTANCE')
        role_name = getattr(chatbot_instance, 'role', 'Unknown Role')
        user_name = getattr(chatbot_instance, 'user', 'Unknown User')

        return jsonify({
            "defaultCharacterImage": default_character_image_token,
            "defaultBackgroundImage": default_background_image_token,
            "roleName": role_name,
            "userName": user_name
        })

    @bp.route('/serve_image', methods=['GET'])
    def serve_image_by_token():
        """Serves an image file based on a token."""
        global image_token_map
        token = request.args.get('token')
        if not token:
            abort(400, "Missing image token")

        path_info = image_token_map.get(token)
        if not path_info:
            abort(404, "Image token not found")

        file_path = path_info['abs_path']

        if not os.path.exists(file_path):
            print(f"Error: File not found for token {token} at path {file_path}")
            abort(404, "Image file not found on server")

        try:
            directory, filename = os.path.split(file_path)
            mime_type, _ = mimetypes.guess_type(file_path)
            if mime_type is None:
                mime_type = 'application/octet-stream'

            return send_from_directory(directory, filename, mimetype=mime_type)

        except Exception as e:
            print(f"Error serving image file {file_path} for token {token}: {e}")
            abort(500, "Error serving image file")

    @bp.route('/chat', methods=['POST'])
    def chat_endpoint():
        chatbot_instance = _ensure_chatbot_active()
        global current_history, current_round

        data = request.json
        user_input = data.get('user_input')
        if not user_input:
            return jsonify({"error": "user_input is required"}), 400
        try:
            app_config = current_app.config.get('APP_CONFIG', {})
            chatbot_kwargs = app_config.get('CHATBOT', {})

            role_description = get_role_desc(current_round, user_input, **chatbot_kwargs.get("ROLE_CONFIG", {}))
            response = chatbot_instance.chat(user_input=user_input, role_description=role_description,
                                             **chatbot_kwargs.get("CHAT_CONFIG", {}))
            image_paths = get_image_file_path(response)
            if not isinstance(image_paths, list):
                print(f"Warning: get_image_file_path did not return a list. Received: {image_paths}")
                image_paths = [image_paths] if image_paths else []

            image_serve_tokens = [_generate_image_token(path) for path in image_paths if path]
            current_user_name = getattr(chatbot_instance, 'user', 'User')
            current_role_name = getattr(chatbot_instance, 'role', 'Assistant')

            current_history.append({"role": current_user_name, "content": user_input})
            response_entry = {
                "role": response.get("role", current_role_name),
                "content": response.get("content", ""),
                "desc": response.get("desc", ""),
                "think": response.get("think", "")
            }
            for key, value in response.items():
                if key not in response_entry:
                    response_entry[key] = value
            current_history.append(response_entry)
            current_round += 1

            return jsonify({
                "response": response,
                "characterImageTokens": image_serve_tokens
            })

        except NotImplementedError as e:
            print(f"ERROR: Chatbot override function not implemented: {e}")
            return jsonify(
                {"error": f"Chatbot function not implemented: {e}. Please check backend/chatbot_override.py."}), 500
        except Exception as e:
            print(f"Error during chat: {e}")
            traceback.print_exc()
            return jsonify({"error": "An error occurred during chat.", "details": str(e)}), 500  # [cite: 12]

    @bp.route('/refresh', methods=['POST'])
    def refresh_endpoint():
        chatbot_instance = _ensure_chatbot_active()
        global image_token_map
        try:
            app_config = current_app.config.get('APP_CONFIG', {})
            chatbot_kwargs = app_config.get('CHATBOT', {})
            response = chatbot_instance.refresh_output(**chatbot_kwargs.get("CHAT_CONFIG", {}))
            if not response:
                return jsonify({"error": f"There is no input or no response."}), 400
            image_paths = get_image_file_path(response)
            if not isinstance(image_paths, list): image_paths = [image_paths] if image_paths else []
            image_serve_tokens = [_generate_image_token(path) for path in image_paths if path]
            return jsonify({"response": response, "characterImageTokens": image_serve_tokens})
        except NotImplementedError as e:
            return jsonify({"error": f"Chatbot function not implemented: {e}"}), 500
        except Exception as e:
            print(f"Error during refresh: {e}")
            traceback.print_exc()
            return jsonify({"error": "An error occurred during refresh.", "details": str(e)}), 500

    @bp.route('/update_input', methods=['POST'])
    def update_input_endpoint():
        chatbot_instance = _ensure_chatbot_active()
        global current_history, image_token_map
        current_user_name = getattr(chatbot_instance, 'user', 'User')
        if not current_history or len(current_history) < 2: return jsonify({"error": "Need history"}), 400
        if current_history[-2].get("role") != current_user_name: return jsonify({"error": "Last msg not user"}), 400

        data = request.json
        new_user_input = data.get('user_input')
        if not new_user_input: return jsonify({"error": "new_user_input required"}), 400

        try:
            app_config = current_app.config.get('APP_CONFIG', {})
            chatbot_kwargs = app_config.get('CHATBOT', {})
            response = chatbot_instance.update_input(user_input=new_user_input, **chatbot_kwargs.get("CHAT_CONFIG", {}))
            if not response:
                return jsonify({"error": f"There is no input or no response."}), 400
            image_paths = get_image_file_path(response)
            if not isinstance(image_paths, list): image_paths = [image_paths] if image_paths else []
            image_serve_tokens = [_generate_image_token(path) for path in image_paths if path]

            current_history = current_history[:-2]
            current_history.append({"role": current_user_name, "content": new_user_input})
            current_role_name = getattr(chatbot_instance, 'role', 'Assistant')
            response_entry = {"role": response.get("role", current_role_name), "content": response.get("content", ""),
                              "desc": response.get("desc", ""), "think": response.get("think", "")}
            for key, value in response.items():
                if key not in response_entry: response_entry[key] = value
            current_history.append(response_entry)

            return jsonify({"response": response, "characterImageTokens": image_serve_tokens})
        except NotImplementedError as e:
            return jsonify({"error": f"Chatbot function not implemented: {e}"}), 500
        except Exception as e:
            print(f"Error during update_input: {e}")  # [cite: 20]
            traceback.print_exc()
            return jsonify({"error": "An error occurred during update input.", "details": str(e)}), 500

    @bp.route('/summarize_current', methods=['POST'])
    def summarize_current_endpoint():
        chatbot_instance = _ensure_chatbot_active()
        try:
            app_config = current_app.config.get('APP_CONFIG', {})
            chatbot_kwargs = app_config.get('CHATBOT', {})
            chatbot_instance.summarize_current_session(**chatbot_kwargs.get("CHAT_CONFIG", {}))
            return jsonify({"status": "Summarized current session"})
        except Exception as e:
            print(f"Error summarizing current session: {e}")
            traceback.print_exc()
            return jsonify({"error": "An error occurred during summarizing current session.", "details": str(e)}), 500

    @bp.route('/summarize_all', methods=['POST'])
    def summarize_all_endpoint():
        chatbot_instance = _ensure_chatbot_active()
        try:
            app_config = current_app.config.get('APP_CONFIG', {})
            chatbot_kwargs = app_config.get('CHATBOT', {})
            chatbot_instance.summarize_all_session(**chatbot_kwargs.get("CHAT_CONFIG", {}))
            return jsonify({"status": "Summarized all sessions"})
        except Exception as e:
            print(f"Error summarizing all sessions: {e}")
            traceback.print_exc()
            return jsonify({"error": "An error occurred during summarizing all sessions.", "details": str(e)}), 500

    @bp.route('/start_new_session', methods=['POST'])
    def start_new_session_endpoint():
        global current_history, current_round, image_token_map
        with current_app.config['CHATBOT_STATUS_LOCK']:
            current_status = current_app.config.get('CHATBOT_STATUS')
            shared_chatbot_instance = current_app.config.get('SHARED_CHATBOT_INSTANCE')

            if shared_chatbot_instance is None or current_status == 'init_failed':
                current_app.config['CHATBOT_STATUS'] = 'init_failed'
                abort(503,"Chatbot instance is not available (global initialization may have failed). Cannot start new session.")

            blocking_statuses_for_new_session = ['memory_editing', 'config_editing',
                                                 'role_graph_editing', 'standard_query_editing',
                                                 'standard_answer_editing',
                                                 'uninitialized']
            if current_status in blocking_statuses_for_new_session:
                abort(503, f"Cannot start new session. System status is '{current_status}'.")
            data = request.json
            auto_summarize_flag = data.get('auto_summarize', False)
            try:
                app_cfg = current_app.config.get('APP_CONFIG', {})
                chatbot_processing_kwargs = app_cfg.get('CHATBOT', {})
                shared_chatbot_instance.start_new_session(auto_summarize=auto_summarize_flag,
                                                          **chatbot_processing_kwargs.get("CHAT_CONFIG", {}))
                current_history.clear()
                current_round = 0
                current_app.config['CHATBOT_STATUS'] = 'active'
                print(f"New session started. Chatbot status set to 'active'.")
                return jsonify({"status": "New session started"})
            except Exception as e_new_sess:
                print(f"Error starting new session: {e_new_sess}")
                traceback.print_exc()
                return jsonify({"error": "An error occurred when starting new session.", "details": str(e_new_sess)}), 500

    @bp.route('/resume_session', methods=['POST'])
    def resume_session_endpoint():
        chatbot_instance = _ensure_chatbot_active()
        global current_history, current_round, image_token_map
        # if chatbot_instance is None:
        #     chatbot_instance = _ensure_chatbot_active()
        if chatbot_instance is None: return jsonify({"error": "Chatbot not initialized."}), 500

        data = request.json
        session_id = data.get('session_id')
        if not session_id: return jsonify({"error": "session_id is required"}), 400

        try:
            app_config = current_app.config.get('APP_CONFIG', {})
            chatbot_kwargs = app_config.get('CHATBOT', {})
            messages = chatbot_instance.resume_session(session_id=session_id, **chatbot_kwargs.get("CHAT_CONFIG", {}))
            if messages is None: return jsonify(
                {"error": f"Session {session_id} not found or could not be resumed."}), 404

            current_history = messages
            current_user_name = getattr(chatbot_instance, 'user', 'User')
            current_round = sum(1 for msg in current_history if msg.get("role") == current_user_name)
            return jsonify({"history": messages})
        except Exception as e:
            print(f"Error resuming session {session_id}: {e}")
            traceback.print_exc()
            return jsonify({"error": "An error occurred during resuming session.", "details": str(e)}), 500

    @bp.route('/clear_current_session', methods=['POST'])
    def clear_current_session_endpoint():
        chatbot_instance = _ensure_chatbot_active()
        global current_history, current_round, image_token_map
        try:
            app_config = current_app.config.get('APP_CONFIG', {})
            chatbot_kwargs = app_config.get('CHATBOT', {})
            chatbot_instance.clear_current_session(**chatbot_kwargs.get("CHAT_CONFIG", {}))
            current_history = []
            current_round = 0
            return jsonify({"status": "Current session cleared"})
        except Exception as e:
            print(f"Error clearing current session: {e}")
            traceback.print_exc()
            return jsonify({"error": "An error occurred during clearing current session.", "details": str(e)}), 500

    @bp.route('/close', methods=['POST'])
    def close_endpoint():
        global image_token_map, current_round, current_history
        with current_app.config['CHATBOT_STATUS_LOCK']:
            chatbot_instance = current_app.config.get('SHARED_CHATBOT_INSTANCE')
            current_status = current_app.config.get('CHATBOT_STATUS')
            if current_status == 'closed' and chatbot_instance is not None:
                 return jsonify({"status": "Chatbot is already closed."})
            if chatbot_instance is None or current_status == 'init_failed':
                current_app.config['CHATBOT_STATUS'] = 'closed'
                return jsonify({"status": "Chatbot not initialized or already closed."})

            data = request.json
            auto_summarize = data.get('auto_summarize', False)
            try:
                app_config = current_app.config.get('APP_CONFIG', {})
                chatbot_kwargs = app_config.get('CHATBOT', {})
                chatbot_instance.close(auto_summarize=auto_summarize, **chatbot_kwargs.get("CHAT_CONFIG", {}))
                current_app.config['CHATBOT_STATUS'] = 'closed'
                current_history.clear()
                current_round = 0
                print("Chatbot closed successfully via API. Status set to 'closed'. Shared instances retained but internally closed.")
                return jsonify({"status": "Chatbot closed"})
            except Exception as e:
                print(f"Error during close: {e}")
                traceback.print_exc()
                return jsonify({"error": "An error occurred during closing chatbot.", "details": str(e)}), 500

    @bp.route('/history', methods=['GET'])
    def get_history_endpoint():
        global current_history
        return jsonify({"history": current_history.copy()})

    @bp.route('/background_upload', methods=['POST'])
    def background_upload():
        if not upload_folder_path_global:
            return jsonify({"error": "Upload path not configured"}), 500

        if 'background' not in request.files: return jsonify({"error": "No file part"}), 400
        file = request.files['background']
        if file.filename == '': return jsonify({"error": "No selected file"}), 400

        allowed_extensions = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
        file_ext = file.filename.split('.')[-1].lower() if '.' in file.filename else ''
        if file_ext not in allowed_extensions: return jsonify({"error": "Invalid file type"}), 400

        try:
            unique_filename = f"{uuid.uuid4().hex}.{file_ext}"
            filepath = os.path.join(upload_folder_path_global, unique_filename)

            chunk_size = 1024 * 64
            with open(filepath, 'wb') as f:
                while True:
                    chunk = file.stream.read(chunk_size)
                    if not chunk: break
                    f.write(chunk)

            file_url = f'/api/chatbot/uploads/{unique_filename}'
            print(f"File uploaded to {filepath}, accessible via {file_url}")
            return jsonify({"url": file_url, "message": "File uploaded successfully"})

        except Exception as e:
            print(f"Error saving uploaded file: {str(e)}")
            print(traceback.format_exc())
            return jsonify({"error": f"Failed to save file: {str(e)}"}), 500

    @bp.route('/uploads/<filename>')
    def serve_uploaded_file(filename):
        if not upload_folder_path_global:
            abort(404, "Upload directory not configured")
        try:
            safe_path = os.path.abspath(os.path.join(upload_folder_path_global, filename))
            if not safe_path.startswith(os.path.abspath(upload_folder_path_global)):
                abort(400, "Invalid file path")
            return send_from_directory(upload_folder_path_global, filename)
        except FileNotFoundError:
            abort(404)
        except Exception as e:
            print(f"Error serving upload {filename}: {e}")
            abort(500)

    return bp
