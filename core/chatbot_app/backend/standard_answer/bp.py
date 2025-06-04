import json
import os
from flask import Blueprint, request, jsonify, current_app, abort

graph_roles_list = []
qna_output_dir = None

bp = Blueprint("standard_answer",__name__, template_folder='templates')

def _begin_standard_answer_write_operation():
    """Sets status to 'standard_answer_editing' if conditions are met."""
    lock = current_app.config['CHATBOT_STATUS_LOCK']
    lock.acquire()
    current_status = current_app.config.get('CHATBOT_STATUS')

    conflicting_statuses = ['active', 'config_editing',
                            'role_graph_editing', 'standard_query_editing']

    if current_status in conflicting_statuses:
        lock.release()
        abort(503, f"Cannot edit standard answers. System status is '{current_status}'.")

    # if current_status not in ['closed', 'standard_answer_editing', 'uninitialized']:
    #     lock.release()
    #     abort(503,
    #           f"Standard answer editing not allowed. System status is '{current_status}'. Must be 'closed' or 'uninitialized'.")

    current_app.config['CHATBOT_STATUS'] = 'standard_answer_editing'
    print(f"Status changed to 'standard_answer_editing'. Previous: {current_status}")
    lock.release()


def _end_standard_answer_write_operation():
    """Resets status to 'closed' if it was 'standard_answer_editing'."""
    lock = current_app.config['CHATBOT_STATUS_LOCK']
    lock.acquire()
    if current_app.config.get('CHATBOT_STATUS') == 'standard_answer_editing':
        current_app.config['CHATBOT_STATUS'] = 'closed'
        print("Status reverted to 'closed' after standard_answer operation.")
    lock.release()


def _check_read_access_for_standard_answer():
    """Checks if read access is permitted based on system status."""
    with current_app.config['CHATBOT_STATUS_LOCK']:
        current_status = current_app.config.get('CHATBOT_STATUS')
        blocking_read_statuses = ['config_editing', 'active']
        if current_status in blocking_read_statuses:
            abort(503, f"Cannot access standard answers. System status is '{current_status}'.")

def create_standard_answer_blueprint(config):
    global qna_output_dir,graph_roles_list
    graph_data_file_path = config['GRAPH_PATH']
    qna_output_dir = config['OUTPUT_DIR']
    print("DEBUG: qna_output_dir\n",qna_output_dir)

    def load_graph_roles_list(filepath):
        """Loads just the list of role names from the graph data file."""
        global graph_roles_list
        if os.path.exists(filepath):
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    graph_data = json.load(f)
                graph_roles_list = list(graph_data.get("roles", {}).keys())
                print(f"Role list loaded successfully from {filepath}.")
            except Exception as e:
                print(f"StandardAnswer: Error loading graph for roles from {filepath}: {e}. Role list empty.")
                graph_roles_list = []
        else:
            print(f"StandardAnswer: Graph file {filepath} not found. Role list empty.")
            graph_roles_list = []

    # Load role list from graph data on startup (needed for role validation)
    load_graph_roles_list(graph_data_file_path)

    # Ensure the output directory for qna files exists
    if not os.path.exists(qna_output_dir):
        os.makedirs(qna_output_dir)
        print(f"Created Q&A output directory: {qna_output_dir}")
    
    def get_qna_filepath(role_name):
        """Constructs the full path for a role's qna file."""
        # safe_role_name = urllib.parse.quote_plus(role_name)
        global qna_output_dir
        return os.path.join(qna_output_dir, f'qna_{role_name}.json')
    
    def load_role_qna(role_name):
        """Loads qna data for a specific role."""
        filepath = get_qna_filepath(role_name)
        if os.path.exists(filepath):
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception as e:
                print(f"Error loading QnA for {role_name} from {filepath}: {e}")
                return {}
        else:
            print(f"Q&A file not found for {role_name} at {filepath}. Returning empty Q&A.")
            return {}
    
    def save_role_qna(role_name, qna_data):
        """Saves qna data for a specific role."""
        global qna_output_dir
        filepath = get_qna_filepath(role_name)
        # Ensure output directory exists
        os.makedirs(qna_output_dir, exist_ok=True)
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(qna_data, f, ensure_ascii=False, indent=2)
            print(f"Q&A data saved successfully for {role_name} to {filepath}")
            return True
        except Exception as e:
            print(f"Error saving Q&A data for {role_name} to {filepath}: {e}")
            return False

    @bp.route('/roles', methods=['GET'])
    def get_roles():
        """Get a list of all role names from the graph data."""
        # Ensure roles are loaded if not already (e.g., in debug reloader)
        _check_read_access_for_standard_answer()
        if not graph_roles_list and 'graph_data_file_path' in globals() and graph_data_file_path:
             load_graph_roles_list(graph_data_file_path)
        return jsonify(graph_roles_list), 200
    
    @bp.route('/role/<role_name>/qna', methods=['GET'])
    def get_role_qna(role_name):
        """Get all standard inputs and answers for a specific role."""
        _check_read_access_for_standard_answer()
        global graph_roles_list
        if role_name not in graph_roles_list:
            return jsonify({"error": f"Role '{role_name}' not found in graph data"}), 404
    
        qna_data = load_role_qna(role_name)
        return jsonify(qna_data), 200
    
    @bp.route('/role/<role_name>/input', methods=['POST'])
    def add_standard_input(role_name):
        """Add a new standard input for a role."""
        _begin_standard_answer_write_operation()
        try:
            global graph_roles_list
            if role_name not in graph_roles_list:
                return jsonify({"error": f"Role '{role_name}' not found in graph data"}), 404

            data = request.json
            standard_input = data.get('input')

            if not standard_input or not standard_input.strip():
                return jsonify({"error": "Standard input text is required"}), 400
            standard_input = standard_input.strip()

            qna_data = load_role_qna(role_name)
            original_qna_data_str = json.dumps(qna_data)

            if standard_input in qna_data:
                return jsonify({"error": f"Standard input '{standard_input}' already exists for role '{role_name}'"}), 409

            qna_data[standard_input] = [] # Add input with an empty answer list

            if save_role_qna(role_name, qna_data):
                return jsonify({"message": "Standard input added successfully"}), 201
            else:
                qna_data.clear()
                qna_data.update(json.loads(original_qna_data_str))
                return jsonify({"error": "Failed to save Q&A data, rollback attempted."}), 500
        except Exception as e:
            if 'original_qna_data_str' in locals() and 'qna_data' in locals():
                qna_data.clear()
                qna_data.update(json.loads(original_qna_data_str))
            print(f"Exception in add_standard_input for {role_name}: {e}")
            return jsonify({"error": f"An internal error occurred: {str(e)}"}), 500
        finally:
            _end_standard_answer_write_operation()
    
    @bp.route('/role/<role_name>/input', methods=['PUT'])
    def update_standard_input(role_name):
        """Update an existing standard input for a role."""
        _begin_standard_answer_write_operation()
        try:
            global graph_roles_list
            if role_name not in graph_roles_list:
                return jsonify({"error": f"Role '{role_name}' not found in graph data"}), 404

            data = request.json
            old_input = data.get('old_input')
            new_input = data.get('new_input')

            if not old_input or not old_input.strip() or not new_input or not new_input.strip():
                return jsonify({"error": "Old and new standard input texts are required"}), 400
            old_input = old_input.strip()
            new_input = new_input.strip()


            qna_data = load_role_qna(role_name)
            original_qna_data_str = json.dumps(qna_data)

            if old_input not in qna_data:
                return jsonify({"error": f"Standard input '{old_input}' not found for role '{role_name}'"}), 404

            if old_input != new_input and new_input in qna_data:
                 return jsonify({"error": f"Standard input '{new_input}' already exists for role '{role_name}'"}), 409

            if old_input == new_input:
                 return jsonify({"message": "No change detected"}), 200

            # Store answers, delete old key, add new key with stored answers
            answers = qna_data[old_input]
            del qna_data[old_input]
            qna_data[new_input] = answers

            if save_role_qna(role_name, qna_data):
                return jsonify({"message": "Standard input updated successfully"}), 200
            else:
                qna_data.clear()
                qna_data.update(json.loads(original_qna_data_str))
                return jsonify({"error": "Failed to save Q&A data, rollback attempted."}), 500
        except Exception as e:
            if 'original_qna_data_str' in locals() and 'qna_data' in locals():
                qna_data.clear()
                qna_data.update(json.loads(original_qna_data_str))
            print(f"Exception in update_standard_input for {role_name}: {e}")
            return jsonify({"error": f"An internal error occurred: {str(e)}"}), 500
        finally:
            _end_standard_answer_write_operation()
    
    @bp.route('/role/<role_name>/input', methods=['DELETE'])
    def delete_standard_input(role_name):
        """Delete a standard input and all its answers for a role."""
        _begin_standard_answer_write_operation()
        try:
            global graph_roles_list
            if role_name not in graph_roles_list:
                return jsonify({"error": f"Role '{role_name}' not found in graph data"}), 404

            data = request.json
            standard_input = data.get('input')

            if not standard_input or not standard_input.strip():
                return jsonify({"error": "Standard input text is required for deletion"}), 400
            standard_input = standard_input.strip()

            qna_data = load_role_qna(role_name)
            original_qna_data_str = json.dumps(qna_data)

            if standard_input not in qna_data:
                return jsonify({"error": f"Standard input '{standard_input}' not found for role '{role_name}'"}), 404

            # Store deleted input and answers for potential rollback
            deleted_input_data = {standard_input: qna_data[standard_input]}
            del qna_data[standard_input]

            if save_role_qna(role_name, qna_data):
                return jsonify({"message": "Standard input deleted successfully"}), 200
            else:
                qna_data.clear()
                qna_data.update(json.loads(original_qna_data_str))
                return jsonify({"error": "Failed to save Q&A data, rollback attempted."}), 500
        except Exception as e:
            if 'original_qna_data_str' in locals() and 'qna_data' in locals():
                qna_data.clear()
                qna_data.update(json.loads(original_qna_data_str))
            print(f"Exception in delete_standard_input for {role_name}: {e}")
            return jsonify({"error": f"An internal error occurred: {str(e)}"}), 500
        finally:
            _end_standard_answer_write_operation()
    
    # Helper to safely encode input for URL (less used now with body payloads)
    # def safe_encode_input(input_str):
    #     return urllib.parse.quote_plus(input_str)
    
    # Helper to safely decode input from URL
    # def safe_decode_input(encoded_str):
    #     return urllib.parse.unquote_plus(encoded_str)
    
    
    @bp.route('/role/<role_name>/answer', methods=['POST'])
    def add_standard_answer(role_name):
        """Add a new standard answer to a specific standard input for a role."""
        _begin_standard_answer_write_operation()
        try:
            global graph_roles_list
            if role_name not in graph_roles_list:
                return jsonify({"error": f"Role '{role_name}' not found in graph data"}), 404

            data = request.json
            standard_input = data.get('input')
            standard_answer = data.get('answer')

            if not standard_input or not standard_input.strip() or not standard_answer or not standard_answer.strip():
                return jsonify({"error": "Standard input and answer texts are required"}), 400
            standard_input = standard_input.strip()
            standard_answer = standard_answer.strip()

            qna_data = load_role_qna(role_name)
            original_qna_data_str = json.dumps(qna_data)

            if standard_input not in qna_data or not isinstance(qna_data.get(standard_input), list):
                if standard_input in qna_data:
                    print(f"Warning: Q&A data for input '{standard_input}' for role '{role_name}' is not a list. Resetting.")
                    qna_data[standard_input] = []
                else:
                     return jsonify({"error": f"Standard input '{standard_input}' not found for role '{role_name}'"}), 404


            if standard_answer in qna_data[standard_input]:
                 return jsonify({"error": f"Standard answer '{standard_answer}' already exists for input '{standard_input}'"}), 409

            qna_data[standard_input].append(standard_answer)

            if save_role_qna(role_name, qna_data):
                return jsonify({"message": "Standard answer added"}), 201
            else:
                qna_data.clear()
                qna_data.update(json.loads(original_qna_data_str))
                return jsonify({"error": "Failed to save Q&A data, rollback attempted."}), 500
        except Exception as e:
            if 'original_qna_data_str' in locals() and 'qna_data' in locals():
                qna_data.clear()
                qna_data.update(json.loads(original_qna_data_str))
            print(f"Exception in add_standard_answer for {role_name}: {e}")
            return jsonify({"error": f"An internal error occurred: {str(e)}"}), 500
        finally:
            _end_standard_answer_write_operation()
    
    @bp.route('/role/<role_name>/answer', methods=['PUT'])
    def update_standard_answer(role_name):
        """Update an existing standard answer by index for a specific standard input."""
        _begin_standard_answer_write_operation()
        try:
            global graph_roles_list
            if role_name not in graph_roles_list:
                return jsonify({"error": f"Role '{role_name}' not found in graph data"}), 404

            data = request.json
            standard_input = data.get('input')
            index = data.get('index')
            new_answer = data.get('new_answer')

            if not standard_input or not standard_input.strip() or index is None or not new_answer or not new_answer.strip():
                return jsonify({"error": "Standard input, index, and new answer text are required"}), 400
            standard_input = standard_input.strip()
            new_answer = new_answer.strip()

            qna_data = load_role_qna(role_name)
            original_qna_data_str = json.dumps(qna_data)
            if standard_input not in qna_data or not isinstance(qna_data.get(standard_input), list):
                 return jsonify({"error": f"Standard input '{standard_input}' not found or has no answers for role '{role_name}'"}), 404

            answers_list = qna_data[standard_input]

            try:
                index = int(index)
                if not (0 <= index < len(answers_list)):
                    return jsonify({"error": f"Invalid answer index {index} for input '{standard_input}'"}), 400

                if new_answer != answers_list[index] and new_answer in answers_list:
                    return jsonify({"error": f"Answer '{new_answer}' already exists for this input"}), 409

                answers_list[index] = new_answer

                if save_role_qna(role_name, qna_data):
                    return jsonify({"message": "Standard answer updated successfully"}), 200
                else:
                    qna_data.clear()
                    qna_data.update(json.loads(original_qna_data_str))
                    return jsonify({"error": "Failed to save Q&A data, rollback attempted."}), 500
            except (ValueError, TypeError):
                return jsonify({"error": "Index must be a valid integer"}), 400
        except Exception as e:
            if 'original_qna_data_str' in locals() and 'qna_data' in locals():
                qna_data.clear()
                qna_data.update(json.loads(original_qna_data_str))
            print(f"Exception in update_standard_answer for {role_name}: {e}")
            return jsonify({"error": f"An internal error occurred: {str(e)}"}), 500
        finally:
            _end_standard_answer_write_operation()
    
    
    @bp.route('/role/<role_name>/answer', methods=['DELETE'])
    def delete_standard_answer(role_name):
        """Delete a standard answer by index for a specific standard input."""
        _begin_standard_answer_write_operation()
        try:
            global graph_roles_list
            if role_name not in graph_roles_list:
                return jsonify({"error": f"Role '{role_name}' not found in graph data"}), 404

            data = request.json
            standard_input = data.get('input')
            index = data.get('index')

            if not standard_input or not standard_input.strip() or index is None:
                return jsonify({"error": "Standard input and index are required for deletion"}), 400
            standard_input = standard_input.strip()

            qna_data = load_role_qna(role_name)
            original_qna_data_str = json.dumps(qna_data)

            if standard_input not in qna_data or not isinstance(qna_data.get(standard_input), list):
                 return jsonify({"error": f"Standard input '{standard_input}' not found or has no answers for role '{role_name}'"}), 404

            answers_list = qna_data[standard_input]

            try:
                index = int(index)
                if not (0 <= index < len(answers_list)):
                    return jsonify({"error": f"Invalid answer index {index}"}), 400

                deleted_answer = answers_list.pop(index)

                # if not answers_list:
                #      del qna_data[standard_input]

                if save_role_qna(role_name, qna_data):
                    return jsonify({"message": "Standard answer deleted successfully"}), 200
                else:
                    qna_data.clear()
                    qna_data.update(json.loads(original_qna_data_str))
                    return jsonify({"error": "Failed to save Q&A data, rollback attempted."}), 500
            except (ValueError, TypeError):
                return jsonify({"error": "Index must be a valid integer"}), 400
        except Exception as e:
            if 'original_qna_data_str' in locals() and 'qna_data' in locals():
                qna_data.clear()
                qna_data.update(json.loads(original_qna_data_str))
            print(f"Exception in delete_standard_answer for {role_name}: {e}")
            return jsonify({"error": f"An internal error occurred: {str(e)}"}), 500
        finally:
            _end_standard_answer_write_operation()
    
    return bp