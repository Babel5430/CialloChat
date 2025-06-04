import json
import os
from flask import Blueprint, request, jsonify, current_app, abort

graph_data = {"roles": {}}
queries_output_dir = None
# --- Flask App Setup ---

def _begin_standard_query_write_operation():
    """Sets status to 'standard_query_editing' if conditions are met."""
    lock = current_app.config['CHATBOT_STATUS_LOCK']
    lock.acquire()
    current_status = current_app.config.get('CHATBOT_STATUS')
    conflicting_statuses = ['active', 'config_editing',
                            'role_graph_editing', 'standard_answer_editing']
    if current_status in conflicting_statuses:
        lock.release()
        abort(503, f"Cannot edit standard queries. System status is '{current_status}'.")

    # if current_status not in ['closed', 'standard_query_editing', 'uninitialized']:
    #     lock.release()
    #     abort(503,
    #           f"Standard query editing not allowed. System status is '{current_status}'. Must be 'closed' or 'uninitialized'.")

    current_app.config['CHATBOT_STATUS'] = 'standard_query_editing'
    print(f"Status changed to 'standard_query_editing'. Previous: {current_status}")
    lock.release()


def _end_standard_query_write_operation():
    """Resets status to 'closed' if it was 'standard_query_editing'."""
    lock = current_app.config['CHATBOT_STATUS_LOCK']
    lock.acquire()
    if current_app.config.get('CHATBOT_STATUS') == 'standard_query_editing':
        current_app.config['CHATBOT_STATUS'] = 'closed'
        print("Status reverted to 'closed' after standard_query operation.")
    lock.release()

def _check_read_access_for_standard_query():
    """Checks if read access is permitted based on system status."""
    with current_app.config['CHATBOT_STATUS_LOCK']:
        current_status = current_app.config.get('CHATBOT_STATUS')
        blocking_read_statuses = ['config_editing', 'active']
        if current_status in blocking_read_statuses:
            abort(503, f"Cannot access standard queries. System status is '{current_status}'.")

bp = Blueprint('standard_query',__name__, template_folder='templates')

def create_standard_query_blueprint(config):
    global queries_output_dir
    graph_data_file_path = config['GRAPH_PATH']
    queries_output_dir = config['OUTPUT_DIR']

    def generate_role_concepts(role_name):
        """Generates the list of concept strings for a role based on graph data."""
        global graph_data
        concepts = []
        role_data = graph_data.get("roles", {}).get(role_name)

        if not role_data:
            return concepts

        attributes = role_data.get("attributes", {})
        for attr_name in attributes.keys():
            concepts.append(attr_name)

        ideas = role_data.get("ideas", {})
        for target_role in ideas.keys():
            if target_role in graph_data.get("roles", {}):
                concepts.append(f"idea_to-{target_role}")
            else:
                print(f"Warning: Target role '{target_role}' in ideas for '{role_name}' not found in graph roles.")

        # 3. Add Memory Concepts
        concepts.append("长期记忆")
        concepts.append("短期记忆")

        return concepts

    def load_graph_data(filepath):
        """Loads graph data from the file (read-only)."""
        global graph_data
        if os.path.exists(filepath):
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    graph_data = json.load(f)
                print(f"Graph data loaded successfully from {filepath} for concepts generation.")
            except json.JSONDecodeError:
                print(f"Error decoding JSON from {filepath}. Concepts based on empty graph.")
                graph_data = {"roles": {}}
            except Exception as e:
                print(f"Error loading graph data from {filepath}: {e}. Concepts based on empty graph.")
                graph_data = {"roles": {}}
        else:
            print(f"Graph data file not found at {filepath}. Concepts based on empty graph.")
            graph_data = {"roles": {}}

    def get_query_filepath(role_name):
        """Constructs the full path for a role's query file."""
        global queries_output_dir
        return os.path.join(queries_output_dir, f'queries_{role_name}.json')

    def load_role_queries(role_name):
        """Loads query data for a specific role."""
        filepath = get_query_filepath(role_name)
        if os.path.exists(filepath):
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except json.JSONDecodeError:
                print(f"Error decoding JSON from {filepath}. Returning empty queries.")
                return {}
            except Exception as e:
                print(f"Error loading queries for {role_name}: {e}. Returning empty queries.")
                return {}
        else:
            print(f"Query file not found for {role_name} at {filepath}. Returning empty queries.")
            return {}

    def save_role_queries(role_name, query_data):
        """Saves query data for a specific role."""
        global queries_output_dir
        filepath = get_query_filepath(role_name)
        # Ensure output directory exists
        os.makedirs(queries_output_dir, exist_ok=True)
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(query_data, f, ensure_ascii=False, indent=2)
            print(f"Query data saved successfully for {role_name} to {filepath}")
            return True
        except Exception as e:
            print(f"Error saving query data for {role_name} to {filepath}: {e}")
            return False
    load_graph_data(graph_data_file_path)
    if not os.path.exists(queries_output_dir):
        os.makedirs(queries_output_dir)
        print(f"Created queries output directory: {queries_output_dir}")

    @bp.route('/roles', methods=['GET'])
    def get_roles():
        """Get a list of all role names from the graph data."""
        _check_read_access_for_standard_query()
        return jsonify(list(graph_data.get("roles", {}).keys())), 200
    
    @bp.route('/role/<role_name>/concepts', methods=['GET'])
    def get_role_concepts(role_name):
        """Get the list of concepts for a specific role."""
        _check_read_access_for_standard_query()
        if role_name not in graph_data.get("roles", {}):
            return jsonify({"error": f"Role '{role_name}' not found in graph data"}), 404
    
        concepts = generate_role_concepts(role_name)
        return jsonify(concepts), 200
    
    @bp.route('/role/<role_name>/queries', methods=['GET'])
    def get_role_all_queries(role_name):
        """Get all query statements for all concepts for a specific role."""
        _check_read_access_for_standard_query()
        if role_name not in graph_data.get("roles", {}):
            return jsonify({"error": f"Role '{role_name}' not found in graph data"}), 404
    
        query_data = load_role_queries(role_name)
        return jsonify(query_data), 200
    
    
    @bp.route('/role/<role_name>/query', methods=['POST'])
    def add_or_update_query(role_name):
        """Add a new query or update an existing one for a concept."""
        _begin_standard_query_write_operation()
        try:
            if role_name not in graph_data.get("roles", {}):
                return jsonify({"error": f"Role '{role_name}' not found in graph data"}), 404

            data = request.json
            concept = data.get('concept')
            query_text = data.get('query')
            index = data.get('index') # null for add, number for update

            if not concept or not query_text:
                return jsonify({"error": "Concept and query text are required"}), 400

            valid_concepts = generate_role_concepts(role_name)
            if concept not in valid_concepts:
                 return jsonify({"error": f"Invalid concept '{concept}' for role '{role_name}'"}), 400

            query_data = load_role_queries(role_name)
            original_query_data_str = json.dumps(query_data)

            if concept not in query_data:
                query_data[concept] = []

            message = ""
            status_code = 200
            if index is None: # Add new query
                if query_text in query_data[concept]:
                    return jsonify({"error": "Query text already exists for this concept"}), 409
                query_data[concept].append(query_text)
                message = "Query added successfully"
                status_code = 201
            else:
                try:
                    index = int(index)
                    if 0 <= index < len(query_data[concept]):
                         if query_text != query_data[concept][index] and query_text in query_data[concept]:
                             return jsonify({"error": "New query text already exists for this concept"}), 409

                         query_data[concept][index] = query_text
                         message = "Query updated successfully"
                         status_code = 200
                    else:
                        return jsonify({"error": f"Invalid index {index} for concept '{concept}'"}), 400
                except (ValueError, TypeError):
                    return jsonify({"error": "Index must be a valid integer or null"}), 400

            if save_role_queries(role_name, query_data):
                return jsonify({"message": message}), status_code
            else:
                query_data.clear()
                query_data.update(json.loads(original_query_data_str))
                return jsonify({"error": "Failed to save query data after modification, rollback attempted."}), 500

        except Exception as e:
            if 'original_query_data_str' in locals() and 'query_data' in locals():
                query_data.clear()
                query_data.update(json.loads(original_query_data_str))
            print(f"Exception in add_or_update_query for {role_name}: {e}")
            return jsonify({"error": f"An internal error occurred: {str(e)}"}),500
        finally:
            _end_standard_query_write_operation()

    
    
    @bp.route('/role/<role_name>/delete_query', methods=['POST'])
    def delete_query(role_name):
        """Delete a query statement for a concept by index."""
        _begin_standard_query_write_operation()
        try:
            if role_name not in graph_data.get("roles", {}):
                return jsonify({"error": f"Role '{role_name}' not found in graph data"}), 404

            data = request.json
            concept = data.get('concept')
            index = data.get('index')

            if not concept or index is None:
                return jsonify({"error": "Concept and index are required"}), 400

            valid_concepts = generate_role_concepts(role_name)
            if concept not in valid_concepts:
                 return jsonify({"error": f"Invalid concept '{concept}' for role '{role_name}'"}), 400

            query_data = load_role_queries(role_name)
            original_query_data_str = json.dumps(query_data)

            if concept not in query_data or not isinstance(query_data[concept], list):
                return jsonify({"error": f"Concept '{concept}' not found or has no queries"}), 404

            try:
                index = int(index)
                if 0 <= index < len(query_data[concept]):
                    del query_data[concept][index]
                    if not query_data[concept]:
                         del query_data[concept]

                    if save_role_queries(role_name, query_data):
                        return jsonify({"message": "Query deleted successfully"}), 200
                    else:
                         query_data.clear()
                         query_data.update(json.loads(original_query_data_str))
                         return jsonify({"error": "Failed to save query data after deletion, rollback attempted."}), 500
                else:
                    return jsonify({"error": f"Invalid index {index} for concept '{concept}'"}), 400
            except (ValueError, TypeError):
                return jsonify({"error": "Index must be a valid integer"}), 400
        except Exception as e_del_q:
            if 'original_query_data_str' in locals() and 'query_data' in locals():
                query_data.clear()
                query_data.update(json.loads(original_query_data_str))
            print(f"Error deleting query for {role_name}: {e_del_q}")
            return jsonify({"error": f"An internal error occurred: {str(e_del_q)}"}), 500
        finally:
            _end_standard_query_write_operation()
    return bp


# --- Main Execution ---
