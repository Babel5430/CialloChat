import json
import os
from flask import Blueprint, request, jsonify, current_app, abort

graph_data = {"roles": {}}
data_file_path = ""

# --- Flask App Setup ---
bp = Blueprint("role_graph", __name__, template_folder='templates')

def _begin_role_graph_write_operation():
    """Sets status to 'role_graph_editing' if conditions are met."""
    lock = current_app.config['CHATBOT_STATUS_LOCK']
    lock.acquire()
    current_status = current_app.config.get('CHATBOT_STATUS')

    conflicting_statuses = ['active', 'config_editing',
                            'standard_query_editing',
                            'standard_answer_editing']

    if current_status in conflicting_statuses:
        lock.release()
        abort(503, f"Cannot edit role graph. System status is '{current_status}'.")

    # if current_status not in ['closed', 'role_graph_editing', 'uninitialized']:
    #     lock.release()
    #     abort(503,f"Role graph editing not allowed. System status is '{current_status}'. Must be 'closed' or 'uninitialized'.")

    current_app.config['CHATBOT_STATUS'] = 'role_graph_editing'
    print(f"Status changed to 'role_graph_editing'. Previous: {current_status}")
    lock.release()


def _end_role_graph_write_operation():
    """Resets status to 'closed' if it was 'role_graph_editing'."""
    lock = current_app.config['CHATBOT_STATUS_LOCK']
    lock.acquire()
    if current_app.config.get('CHATBOT_STATUS') == 'role_graph_editing':
        current_app.config['CHATBOT_STATUS'] = 'closed'
        print("Status reverted to 'closed' after role_graph operation.")
    lock.release()


def _check_read_access_for_role_graph():
    """Checks if read access is permitted based on system status."""
    with current_app.config['CHATBOT_STATUS_LOCK']:
        current_status = current_app.config.get('CHATBOT_STATUS')
        if current_status in ['config_editing', 'active']:
            abort(503, f"Cannot access role graph. System status is '{current_status}'.")

# --- API Endpoints ---

def create_role_graph_blueprint(config):
    global graph_data, data_file_path
    def load_graph(filepath):
        """Loads graph data from a JSON file."""
        global graph_data
        if os.path.exists(filepath):
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    graph_data = json.load(f)
                print(f"Graph data loaded successfully from {filepath}")
            except json.JSONDecodeError:
                print(f"Error decoding JSON from {filepath}. Starting with empty graph.")
                graph_data = {"roles": {}}
            except Exception as e:
                print(f"Error loading graph data from {filepath}: {e}. Starting with empty graph.")
                graph_data = {"roles": {}}
        else:
            print(f"Data file not found at {filepath}. Starting with empty graph.")
            graph_data = {"roles": {}}

    def save_graph():
        """Saves current graph data to the JSON file."""
        global graph_data, data_file_path
        try:
            with open(data_file_path, 'w', encoding='utf-8') as f:
                json.dump(graph_data, f, ensure_ascii=False, indent=2)
            print(f"Graph data saved successfully to {data_file_path}")
            return True
        except Exception as e:
            print(f"Error saving graph data to {data_file_path}: {e}")
            return False

    data_file_path = config['DATA_PATH']
    load_graph(data_file_path)
    data_dir = os.path.dirname(data_file_path)
    if data_dir and not os.path.exists(data_dir):
        os.makedirs(data_dir)
        print(f"Created data directory: {data_dir}")

    @bp.route('/graph', methods=['GET'])
    def get_graph():
        """Get the entire graph data."""
        _check_read_access_for_role_graph()
        return jsonify(graph_data), 200


    @bp.route('/roles', methods=['GET'])
    def get_roles():
        """Get a list of all role names."""
        _check_read_access_for_role_graph()
        return jsonify(list(graph_data.get("roles", {}).keys())), 200


    @bp.route('/role', methods=['POST'])
    def add_role():
        """Add a new role."""
        _begin_role_graph_write_operation()
        try:
            data = request.json
            role_name = data.get('role_name')
            if not role_name:
                return jsonify({"error": "Role name is required"}), 400
            if role_name in graph_data.get("roles", {}):
                return jsonify({"error": f"Role '{role_name}' already exists"}), 409

            graph_data["roles"][role_name] = {"attributes": {}, "ideas": {}}
            if save_graph():
                return jsonify({"message": f"Role '{role_name}' added"}), 201
            else:
                if role_name in graph_data.get("roles", {}):
                    del graph_data["roles"][role_name]
                return jsonify({"error": "Failed to save graph data"}), 500
        finally:
            _end_role_graph_write_operation()


    @bp.route('/role/<role_name>', methods=['DELETE'])
    def delete_role(role_name):
        """Delete a role and its related data."""
        _begin_role_graph_write_operation()
        try:
            if role_name not in graph_data.get("roles", {}):
                return jsonify({"error": f"Role '{role_name}' not found"}), 404

            original_graph_data = json.loads(json.dumps(graph_data))
            del graph_data["roles"][role_name]

            # 2. Remove ideas from other roles to this role
            for source_role_name, source_role_data in graph_data["roles"].items():
                if role_name in source_role_data.get("ideas", {}):
                    del source_role_data["ideas"][role_name]

            # 3. Remove role from access_rights in all descriptions
            for current_role_name, current_role_data in graph_data["roles"].items():
                for attr_name, descriptions in current_role_data.get("attributes", {}).items():
                    for i in range(len(descriptions))[-1::-1]:
                        desc = descriptions[i]
                        if isinstance(desc.get("access_rights"), list):
                            desc["access_rights"] = [
                                ar for ar in desc["access_rights"] if ar != role_name
                            ]
                        elif isinstance(desc.get("access_rights"), str):
                            if desc["access_rights"] == role_name:
                                descriptions.pop(i)

            if save_graph():
                return jsonify({"message": f"Role '{role_name}' and related data deleted"}), 200
            else:
                graph_data.clear()
                graph_data.update(original_graph_data)  # Simple rollback, might be incomplete for complex changes
                return jsonify({"error": "Failed to save graph data after deletion, rollback attempted."}), 500

        except Exception as e_del_role:
            if 'original_graph_data' in locals():
                graph_data.clear()
                graph_data.update(json.loads(original_graph_data))
            return jsonify({"error": f"An error occurred during deletion: {str(e_del_role)}, rollback attempted."}), 500
        finally:
            _end_role_graph_write_operation()


    @bp.route('/role/<role_name>/attribute', methods=['POST'])
    def add_attribute_description(role_name):
        """Add an attribute description to a role.
           Default access_rights is "unlimited" if not provided or empty list/null."""
        _begin_role_graph_write_operation()
        try:
            if role_name not in graph_data.get("roles", {}):
                return jsonify({"error": f"Role '{role_name}' not found"}), 404

            data = request.json
            attribute_name = data.get('attribute_name')
            description = data.get('description')
            access_rights = data.get('access_rights')  # Can be list, "unlimited", null, or missing

            if not attribute_name or not description:
                return jsonify({"error": "Attribute name and description are required"}), 400
            #
            # Determine access rights
            if access_rights is None or (isinstance(access_rights, list) and not access_rights):
                # Default to unlimited if not provided, null, or empty list
                final_access_rights = "unlimited"
            elif isinstance(access_rights, list) or access_rights == "unlimited":
                # Validate roles in access_rights list if it's a list
                if isinstance(access_rights, list):
                    valid_roles = graph_data["roles"].keys()
                    invalid_roles = [ar for ar in access_rights if ar not in valid_roles]
                    if invalid_roles:
                        return jsonify({"error": f"Invalid roles in access_rights: {', '.join(invalid_roles)}"}), 400
                final_access_rights = access_rights
            else:
                return jsonify({"error": "Invalid format for access_rights. Must be 'unlimited' or a list of role names."}), 400

            role_data = graph_data["roles"][role_name]
            original_role_data = json.loads(json.dumps(role_data))
            if "attributes" not in role_data:
                role_data["attributes"] = {}
            if attribute_name not in role_data["attributes"]:
                role_data["attributes"][attribute_name] = []

            role_data["attributes"][attribute_name].append({
                "description": description,
                "access_rights": final_access_rights
            })

            if save_graph():
                return jsonify({"message": "Attribute description added successfully"}), 201
            else:
                if role_name in graph_data["roles"] and 'original_role_data' in locals():
                    graph_data["roles"][role_name].clear()
                    graph_data["roles"][role_name].update(json.loads(original_role_data))

                return jsonify({"error": "Failed to save role data"}), 500
        except Exception as e_del_role:
                if role_name in graph_data["roles"] and 'original_role_data' in locals():
                    graph_data["roles"][role_name].clear()
                    graph_data["roles"][role_name].update(json.loads(original_role_data))
                return jsonify(
                    {"error": f"An error occurred during deletion: {str(e_del_role)}, rollback attempted."}), 500
        finally:
            _end_role_graph_write_operation()



    @bp.route('/role/<source_role>/add_description_for/<target_role>', methods=['POST'])
    def add_description_for_other_role(source_role, target_role):
        """Add an attribute description to target_role from source_role's perspective.
           Access rights default to [source_role]."""
        try:
            if source_role not in graph_data.get("roles", {}):
                return jsonify({"error": f"Source role '{source_role}' not found"}), 404
            if target_role not in graph_data.get("roles", {}):
                return jsonify({"error": f"Target role '{target_role}' not found"}), 404

            data = request.json
            attribute_name = data.get('attribute_name')
            description = data.get('description')

            if not attribute_name or not description:
                return jsonify({"error": "Attribute name and description are required"}), 400

            final_access_rights = [source_role]

            target_role_data = graph_data["roles"][target_role]
            original_role_data = json.loads(json.dumps(target_role_data))
            if "attributes" not in target_role_data:
                target_role_data["attributes"] = {}
            if attribute_name not in target_role_data["attributes"]:
                target_role_data["attributes"][attribute_name] = []

            find = False
            for item in target_role_data["attributes"][attribute_name]:
                if item["description"] == description:
                    find = True
                    item["access_rights"] = item["access_rights"].extend(final_access_rights) if item["access_rights"] else final_access_rights
                    break
            if not find:
                target_role_data["attributes"][attribute_name].append({
                    "description": description,
                    "access_rights": final_access_rights
                })

            if save_graph():
                return jsonify({"message": f"Attribute description added for '{target_role}' by '{source_role}'"}), 201
            else:
                if target_role in graph_data["roles"] and 'original_role_data' in locals():
                    graph_data["roles"][target_role].clear()
                    graph_data["roles"][target_role].update(json.loads(original_role_data))

                return jsonify({"error": "Failed to save role data"}), 500
        except Exception as e_del_role:
                if target_role in graph_data["roles"] and 'original_role_data' in locals():
                    graph_data["roles"][target_role].clear()
                    graph_data["roles"][target_role].update(json.loads(original_role_data))
                return jsonify(
                    {"error": f"An error occurred during deletion: {str(e_del_role)}, rollback attempted."}), 500
        finally:
            _end_role_graph_write_operation()


    @bp.route('/role/<source_role>/idea', methods=['POST'])
    def add_idea(source_role):
        """Add an idea from source_role to target_role."""
        try:
            if source_role not in graph_data.get("roles", {}):
                return jsonify({"error": f"Source role '{source_role}' not found"}), 404

            data = request.json
            target_role = data.get('target_role')
            idea = data.get('idea')

            if not target_role or not idea:
                return jsonify({"error": "Target role and idea text are required"}), 400
            if target_role not in graph_data.get("roles", {}):
                return jsonify({"error": f"Target role '{target_role}' not found"}), 404

            source_role_data = graph_data["roles"][source_role]
            original_role_data = json.loads(json.dumps(source_role_data))
            if "ideas" not in source_role_data:
                source_role_data["ideas"] = {}
            if target_role not in source_role_data["ideas"]:
                source_role_data["ideas"][target_role] = []

            source_role_data["ideas"][target_role].append(idea)

            if save_graph():
                return jsonify({"message": f"Idea added from '{source_role}' to '{target_role}'"}), 201
            else:
                if target_role in graph_data["roles"] and 'original_role_data' in locals():
                    graph_data["roles"][target_role].clear()
                    graph_data["roles"][target_role].update(json.loads(original_role_data))
                return jsonify({"error": "Failed to save role data"}), 500
        except Exception as e_del_role:
                if source_role in graph_data["roles"] and 'original_role_data' in locals():
                    graph_data["roles"][source_role].clear()
                    graph_data["roles"][source_role].update(json.loads(original_role_data))
                return jsonify(
                    {"error": f"An error occurred during deletion: {str(e_del_role)}, rollback attempted."}), 500
        finally:
            _end_role_graph_write_operation()


    @bp.route('/parse/attributes/<role_name>', methods=['POST'])
    def parse_role_attributes(role_name):
        """Parse a role's attributes into a natural language list."""
        _check_read_access_for_role_graph()
        if role_name not in graph_data.get("roles", {}):
            return jsonify({"error": f"Role '{role_name}' not found"}), 404

        role_data = graph_data["roles"][role_name]
        all_attr = []

        attributes = role_data.get("attributes", {})
        if not attributes:
            pass
        else:
            for attr_name, descriptions in attributes.items():
                parsed_dict = {}
                if not descriptions:
                    continue
                else:
                    for desc in descriptions:
                        if not desc.get("description", None):
                            continue
                        access = desc.get("access_rights", "unlimited")
                        if isinstance(access, list):
                            access_str = f"对于{', '.join(access)}来说，" if access else ""
                            all_attr.append(access_str + f"{role_name}的{attr_name}包括: " + desc['description'])
                        elif isinstance(access, str):
                            if (not access or access == "unlimited"):
                                all_attr.append(f"{role_name}的{attr_name}包括: " + desc['description'])
                            else:
                                if not parsed_dict.get(access, None):
                                    parsed_dict[access] = [desc['description']]
                                elif isinstance(parsed_dict[access], list):
                                    parsed_dict[access].append(desc['description'])

                    for access, descs in parsed_dict.items():
                        all_attr.append(f"对于{access}来说，" + f"{role_name}的{attr_name}包括: " + ";".join(descs))

        return jsonify(all_attr), 200


    @bp.route('/parse/accessible_descriptions/<role_name>', methods=['POST'])
    def parse_accessible_descriptions(role_name):
        """Parse descriptions accessible by role_name from other roles."""
        _check_read_access_for_role_graph()
        if role_name not in graph_data.get("roles", {}):
            return jsonify({"error": f"Role '{role_name}' not found"}), 404

        accessible_data = {}

        for other_role_name, other_role_data in graph_data.get("roles", {}).items():
            if other_role_name == role_name:
                continue

            accessible_descriptions_list = []
            attributes = other_role_data.get("attributes", {})
            for attr_name, descriptions in attributes.items():
                for desc_obj in descriptions:
                    description = desc_obj.get("description")
                    access_rights = desc_obj.get("access_rights", "unlimited")

                    can_access = False
                    if access_rights == "unlimited":
                        can_access = True
                    elif isinstance(access_rights, list) and role_name in access_rights:
                        can_access = True

                    if can_access and description:
                        # Include attribute name in the description for clarity
                        accessible_descriptions_list.append(f"{attr_name}: {description}")

            if accessible_descriptions_list:
                accessible_data[other_role_name] = accessible_descriptions_list

        parsed_list = []
        if not accessible_data:
            pass
        else:
            for other_role, descriptions in accessible_data.items():
                for desc in descriptions:
                    parsed_list.append(desc)

        return jsonify(parsed_list), 200


    @bp.route('/parse/ideas/<source_role>/<target_role>', methods=['POST'])
    def parse_ideas_between_roles(source_role, target_role):
        """Parse ideas from source_role to target_role."""
        _check_read_access_for_role_graph()
        if source_role not in graph_data.get("roles", {}):
            return jsonify({"error": f"Source role '{source_role}' not found"}), 404
        if target_role not in graph_data.get("roles", {}):
            return jsonify({"error": f"Target role '{target_role}' not found"}), 404

        source_role_data = graph_data["roles"][source_role]
        ideas = source_role_data.get("ideas", {}).get(target_role, [])

        parsed_list = []
        if not ideas:
            pass
        else:
            for i, idea in enumerate(ideas):
                parsed_list.append(idea)

        return jsonify([f"{source_role}对{target_role}的看法 ：" + ";".join(parsed_list)]), 200


    @bp.route('/save', methods=['POST'])
    def save_current_graph():
        """Manually trigger saving the graph."""
        if save_graph():
            return jsonify({"message": "Graph data saved successfully"}), 200
        else:
            return jsonify({"error": "Failed to save graph data"}), 500


    @bp.route('/role/<role_name>/attribute/<attribute_name>', methods=['DELETE'])
    def delete_attribute(role_name, attribute_name):
        """Delete an entire attribute and all its descriptions for a role."""
        _begin_role_graph_write_operation()
        if role_name not in graph_data.get("roles", {}):
            return jsonify({"error": f"Role '{role_name}' not found"}), 404

        role_data = graph_data["roles"][role_name]
        attributes = role_data.get("attributes", {})

        if attribute_name not in attributes:
            return jsonify({"error": f"Attribute '{attribute_name}' not found for role '{role_name}'"}), 404

        original_graph_data = json.loads(json.dumps(graph_data)) # For potential rollback

        try:
            del attributes[attribute_name]
            # Optional: clean up attributes dict if it becomes empty
            if not attributes:
                 del role_data["attributes"]

            if save_graph():
                return jsonify({"message": f"Attribute '{attribute_name}' deleted for role '{role_name}'"}), 200
            else:
                # Rollback if save fails
                graph_data.update(original_graph_data)
                return jsonify({"error": "Failed to save graph data after attribute deletion, rollback attempted."}), 500
        except Exception as e:
             graph_data.update(original_graph_data)
             return jsonify({"error": f"An error occurred during attribute deletion: {e}, rollback attempted."}), 500
        finally:
            _end_role_graph_write_operation()


    @bp.route('/role/<role_name>/attribute/<attribute_name>/description/<int:index>', methods=['DELETE'])
    def delete_description(role_name, attribute_name, index):
        """Delete a specific description by index within an attribute for a role."""
        _begin_role_graph_write_operation()
        if role_name not in graph_data.get("roles", {}):
            return jsonify({"error": f"Role '{role_name}' not found"}), 404

        role_data = graph_data["roles"][role_name]
        attributes = role_data.get("attributes", {})

        if attribute_name not in attributes or not isinstance(attributes.get(attribute_name), list):
            return jsonify({"error": f"Attribute '{attribute_name}' not found or has no descriptions for role '{role_name}'"}), 404

        descriptions = attributes[attribute_name]

        if not (0 <= index < len(descriptions)):
            return jsonify({"error": f"Invalid description index {index} for attribute '{attribute_name}'"}), 400

        original_graph_data = json.loads(json.dumps(graph_data)) # For potential rollback

        try:
            deleted_description = descriptions.pop(index)

            # Optional: clean up attribute/attributes dict if lists become empty
            if not descriptions:
                 del attributes[attribute_name]
                 if not attributes:
                      del role_data["attributes"]


            if save_graph():
                return jsonify({"message": f"Description at index {index} deleted from attribute '{attribute_name}' for role '{role_name}'"}), 200
            else:
                # Rollback if save fails
                # Need to re-insert at original index if possible, or reload original state
                graph_data.update(original_graph_data)
                return jsonify({"error": "Failed to save graph data after description deletion, rollback attempted."}), 500
        except Exception as e:
             graph_data.update(original_graph_data)
             return jsonify({"error": f"An error occurred during description deletion: {e}, rollback attempted."}), 500
        finally:
            _end_role_graph_write_operation()


    @bp.route('/role/<source_role>/ideas_to/<target_role>', methods=['DELETE'])
    def delete_all_ideas_to_target(source_role, target_role):
        """Delete all ideas from a source role towards a specific target role."""
        _begin_role_graph_write_operation()
        if source_role not in graph_data.get("roles", {}):
            return jsonify({"error": f"Source role '{source_role}' not found"}), 404
        if target_role not in graph_data.get("roles", {}):
             # Allow deleting ideas even if target role was deleted? Current logic requires target exists. Let's keep it simple.
             return jsonify({"error": f"Target role '{target_role}' not found"}), 404


        source_role_data = graph_data["roles"][source_role]
        ideas = source_role_data.get("ideas", {})

        if target_role not in ideas:
            return jsonify({"error": f"No ideas found from '{source_role}' to '{target_role}'"}), 404

        original_graph_data = json.loads(json.dumps(graph_data)) # For potential rollback

        try:
            del ideas[target_role]
            # Optional: clean up ideas dict if it becomes empty
            if not ideas:
                 del source_role_data["ideas"]

            if save_graph():
                return jsonify({"message": f"All ideas from '{source_role}' to '{target_role}' deleted"}), 200
            else:
                 graph_data.update(original_graph_data)
                 return jsonify({"error": "Failed to save graph data after ideas deletion, rollback attempted."}), 500
        except Exception as e:
             graph_data.update(original_graph_data)
             return jsonify({"error": f"An error occurred during ideas deletion: {e}, rollback attempted."}), 500
        finally:
            _end_role_graph_write_operation()


    @bp.route('/role/<source_role>/idea_to/<target_role>/<int:index>', methods=['DELETE'])
    def delete_specific_idea(source_role, target_role, index):
        """Delete a specific idea by index from a source role towards a target role."""
        _begin_role_graph_write_operation()
        if source_role not in graph_data.get("roles", {}):
            return jsonify({"error": f"Source role '{source_role}' not found"}), 404
        if target_role not in graph_data.get("roles", {}):
             return jsonify({"error": f"Target role '{target_role}' not found"}), 404

        source_role_data = graph_data["roles"][source_role]
        ideas = source_role_data.get("ideas", {})

        if target_role not in ideas or not isinstance(ideas.get(target_role), list):
             return jsonify({"error": f"No ideas found or ideas data is invalid from '{source_role}' to '{target_role}'"}), 404

        ideas_list = ideas[target_role]

        if not (0 <= index < len(ideas_list)):
            return jsonify({"error": f"Invalid idea index {index} from '{source_role}' to '{target_role}'"}), 400

        original_graph_data = json.loads(json.dumps(graph_data)) # For potential rollback

        try:
            deleted_idea = ideas_list.pop(index)

            # Optional: clean up target_role entry or ideas dict if list becomes empty
            if not ideas_list:
                 del ideas[target_role]
                 if not ideas:
                      del source_role_data["ideas"]

            if save_graph():
                return jsonify({"message": f"Idea at index {index} from '{source_role}' to '{target_role}' deleted"}), 200
            else:
                 graph_data.update(original_graph_data)
                 return jsonify({"error": "Failed to save graph data after idea deletion, rollback attempted."}), 500
        except Exception as e:
             graph_data.update(original_graph_data)
             return jsonify({"error": f"An error occurred during idea deletion: {e}, rollback attempted."}), 500
        finally:
            _end_role_graph_write_operation()

    return bp