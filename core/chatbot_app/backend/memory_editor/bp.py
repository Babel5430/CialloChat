from flask import Blueprint, request, jsonify, current_app, abort
import uuid
import traceback
from typing import Optional, Any, List, Set, Union

# from MemForest.manager.memory_system import MemorySystem
from MemForest.memory import MemoryUnit, SessionMemory, LongTermMemory
memory_system: Optional['MemorySystem'] = None
pending_tasks_queue = []
pending_task_details = {}
bp = Blueprint("memory_editor", __name__, template_folder='templates')

def _parse_rank1_group_id(group_id_value: Optional[Union[str, List[str]]]) -> Set[str]:
    """ Parses group_id for rank 1 units into a set of LTM IDs. """
    if not group_id_value:
        return set()
    if isinstance(group_id_value, list):
        return set(str(gid) for gid in group_id_value)
    if isinstance(group_id_value, str):
        return {str(group_id_value)}
    return set()

def _serialize_rank1_group_id(ltm_id_set: Set[str]) -> Optional[List[str]]:
    """ Serializes a set of LTM IDs for storage as group_id for rank 1 units (always list or None). """
    if not ltm_id_set:
        return None
    return list(ltm_id_set)


def _get_shared_memory_system_and_check_status(for_write_operation: bool = False):
    """
    Retrieves the shared MemorySystem instance and checks/updates CHATBOT_STATUS.
    If for_write_operation is True, it will try to transition status from 'closed' to 'memory_editing'.
    """
    global memory_system
    if not current_app:
        print("FATAL: Flask current_app not available in _get_shared_memory_system_and_check_status.")
        abort(500, "Application context error.")

    with current_app.config['CHATBOT_STATUS_LOCK']:
        current_status = current_app.config.get('CHATBOT_STATUS')
        if memory_system is None:
            shared_ms = current_app.config.get('SHARED_MEMORY_SYSTEM')
            if shared_ms is None:
                print("ERROR: Shared MemorySystem not found in app.config. Chatbot might not be initialized.")
                abort(503, "Memory system is not available. Initialize chatbot first.")
            memory_system = shared_ms
            print("MemoryEditor: Obtained MemorySystem from shared config.")

        blocking_statuses_for_editor = [
            'active', 'uninitialized', 'init_failed', 'config_editing',
            'role_graph_editing', 'standard_query_editing', 'standard_answer_editing'
        ]
        if for_write_operation:
            if current_status in blocking_statuses_for_editor:
                print(f"ERROR: MemoryEditor write operation attempted while system status is '{current_status}'.")
                abort(403, f"System is busy or in a conflicting state ({current_status}). Cannot perform memory editing.")
            elif current_status == 'closed':
                current_app.config['CHATBOT_STATUS'] = 'memory_editing'
                print("MemoryEditor: Status changed from 'closed' to 'memory_editing' for write operation.")
            elif current_status != 'memory_editing':
                print(f"ERROR: MemoryEditor encountered unexpected system status '{current_status}' for write operation.")
                abort(500, f"Unexpected system status: {current_status}")
        else:
            read_allowed_statuses = ['closed', 'memory_editing']
            if current_status not in read_allowed_statuses:
                print(f"INFO: MemoryEditor read operation attempted while system status is '{current_status}'. Access denied.")
                abort(403, f"Memory editor access denied due to system status: {current_status}. Must be 'closed' or 'memory_editing'.")

    if memory_system and hasattr(memory_system, 'ensure_initialized'):
        try:
            memory_system.ensure_initialized()
        except Exception as e_init_ms:
            print(f"ERROR: Failed to ensure shared MemorySystem is initialized for MemoryEditor: {e_init_ms}")
            traceback.print_exc()
            abort(500, f"Failed to initialize shared memory system: {str(e_init_ms)}")

    if memory_system is None:
        abort(503, "Memory system could not be prepared for use.")

    return memory_system

def create_memory_editor_blueprint(memory_editor_config):
    """
    Creates and configures the Flask Blueprint for the Memory Editor.
    Args:
        memory_editor_config: Configuration for the memory editor (if any specific settings needed).
    Returns:
        The configured Flask Blueprint.
    """
    def _generate_task_id():
        """Generates a unique ID for a task."""
        return f"task_{uuid.uuid4()}"

    def enqueue_task(func, description, *args, **kwargs):
        """Adds a task to the pending queue."""
        task_id = _generate_task_id()
        pending_task_details[task_id] = {'func': func, 'args': args, 'kwargs': kwargs}
        pending_tasks_queue.append({'task_id': task_id, 'description': description})
        return task_id

    # --- Task Queue API Endpoints ---

    @bp.route('/tasks', methods=['GET'])
    def get_pending_tasks():
        """Retrieves the list of pending tasks."""
        return jsonify(pending_tasks_queue)

    @bp.route('/tasks/<task_id>/confirm', methods=['POST'])
    def confirm_task(task_id):
        """Confirms and executes a specific task from the queue."""
        current_memory_system = _get_shared_memory_system_and_check_status(for_write_operation=True)
        if task_id not in pending_task_details:
            return jsonify({"error": "Task not found"}), 404

        task_info = pending_task_details[task_id]
        func = task_info['func']
        args = task_info['args']
        kwargs = task_info['kwargs']

        try:
            if memory_system != current_memory_system:
                 print("CRITICAL: Mismatch in memory system instance for task execution.")
                 abort(500, "Memory system instance mismatch.")
            result, status_code = func(*args, **kwargs)

            pending_task_details.pop(task_id, None)
            global pending_tasks_queue
            pending_tasks_queue = [t for t in pending_tasks_queue if t['task_id'] != task_id]

            return jsonify(result), status_code
        except Exception as e:
            print(f"Error executing task {task_id}: {e}")
            traceback.print_exc()
            # Optionally keep the task for retry or return a specific error
            return jsonify({"error": f"Failed to execute task {task_id}: {str(e)}"}), 500

    @bp.route('/tasks/<task_id>/cancel', methods=['DELETE'])
    def cancel_task(task_id):
        """Cancels and removes a task from the queue."""
        _get_shared_memory_system_and_check_status(for_write_operation=True)
        if task_id not in pending_task_details:
            return jsonify({"error": "Task not found"}), 404

        pending_task_details.pop(task_id, None)
        global pending_tasks_queue
        pending_tasks_queue = [t for t in pending_tasks_queue if t['task_id'] != task_id]

        return jsonify({"message": f"Task {task_id} cancelled"}), 200

    # --- Helper: Recursive Deletion ---
    async def _delete_unit_recursively_core_async(async_system: Any, unit_id: str, deleted_set: Set[str]):
        """
        Core recursive deletion: Deletes a unit and all its children.
        This is the general "delete a tree" logic.
        """
        if not unit_id or unit_id in deleted_set:
            return
        unit = await async_system._get_memory_unit(unit_id)
        if not unit:
            return
        deleted_set.add(unit_id)

        children_to_delete = list(unit.children_ids or [])
        for child_id in children_to_delete:
            await _delete_unit_recursively_core_async(async_system, child_id, deleted_set)

        await async_system._stage_memory_unit_deletion(unit_id)

    async def _delete_unit_recursively_async(async_system, unit_id: str, deleted_set: Set[str], delete_rank1: bool = True):
        """Helper to recursively stage units for deletion, respecting rank rules."""
        if not unit_id or unit_id in deleted_set: return
        unit = await async_system._get_memory_unit(unit_id)
        if not unit: return
        deleted_set.add(unit_id)

        if unit.rank >= 1 and (unit.rank >= 2 or delete_rank1):
            children_to_delete = list(unit.children_ids)
            for child_id in children_to_delete:
                await _delete_unit_recursively_async(async_system, child_id, deleted_set, delete_rank1)

        # Stage for deletion if it meets criteria
        if unit.rank >= 2 or (unit.rank == 1 and delete_rank1) or unit.rank == 0:
            await async_system._stage_memory_unit_deletion(unit_id)

    def _create_memory_unit_db(data):
        """Creates a MemoryUnit using MemorySystem, respecting provided edges."""
        global memory_system
        if not memory_system: abort(503, "Memory system not initialized for DB operation.")
        try:
            content = data.get('content')
            if not content: return {"error": "Content is required"}, 400

            new_id = data.get('memory_unit_id', str(uuid.uuid4()))
            unit_data_for_obj = data.copy()
            unit_data_for_obj['id'] = new_id
            if 'memory_unit_id' in unit_data_for_obj: del unit_data_for_obj['memory_unit_id']

            unit = MemoryUnit.from_dict(unit_data_for_obj)
            unit.id = new_id
            memory_system._stage_memory_unit_update(unit, operation='add')

            if unit.parent_id:
                parent_unit = memory_system._get_memory_unit(unit.parent_id)
                if parent_unit:
                    if new_id not in parent_unit.children_ids:
                        parent_unit.children_ids.append(new_id)
                    memory_system._stage_memory_unit_update(
                        None, unit_id=parent_unit.id, operation='edge_update',
                        update_type='children', update_details=(parent_unit.id, parent_unit.children_ids)
                    )
            if unit.pre_id:
                pre_unit = memory_system._get_memory_unit(unit.pre_id)
                if pre_unit:
                    memory_system._stage_memory_unit_update(None, unit_id=unit.pre_id, operation='edge_update', update_type='sequence', update_details=(pre_unit.pre_id, new_id))
            if unit.next_id:
                next_unit = memory_system._get_memory_unit(unit.next_id)
                if next_unit:
                    memory_system._stage_memory_unit_update(None, unit_id=unit.next_id, operation='edge_update', update_type='sequence', update_details=(new_id, next_unit.next_id))
            memory_system._flush_cache(force=True)
            new_unit_obj = memory_system._get_memory_unit(new_id)
            return new_unit_obj.to_dict() if new_unit_obj else {"error": "Failed to fetch created unit"}, 201
        except Exception as e:
            print(f"Error creating memory unit: {e}"); traceback.print_exc()
            return {"error": f"An error occurred: {e}"}, 500

    def _update_memory_unit_db(unit_id, data):
        """Updates a MemoryUnit using MemorySystem."""
        global memory_system
        if not memory_system: abort(503, "Memory system not initialized for DB operation.")
        try:
            unit = memory_system._get_memory_unit(unit_id)
            if not unit: return {"error": "MemoryUnit not found"}, 404
            content_changed = False
            core_data_changed = False
            edges_to_stage = {}
            for field, value in data.items():
                if field == "id": continue
                if hasattr(unit, field):
                    if getattr(unit, field) != value:
                        if field == 'content':
                            unit.content = value
                            content_changed = True
                        elif field in ['parent_id', 'pre_id', 'next_id', 'group_id', 'rank', 'children_ids']:
                            if field == 'parent_id':
                                edges_to_stage['parent'] = value
                            elif field == 'pre_id':
                                edges_to_stage['sequence_pre'] = value
                            elif field == 'next_id':
                                edges_to_stage['sequence_next'] = value
                            elif field == 'group_id':
                                edges_to_stage['group_id_val'] = value
                            elif field == 'rank':
                                edges_to_stage['rank_val'] = value
                            elif field == 'children_ids':
                                edges_to_stage['children'] = value
                        else:
                            setattr(unit, field, value)
                            core_data_changed = True
            if content_changed:
                memory_system._stage_memory_unit_update(unit, operation='content_update')
            elif core_data_changed:
                memory_system._stage_memory_unit_update(unit, operation='core_data_update')
            if 'parent' in edges_to_stage:
                memory_system._stage_memory_unit_update(None, unit_id, 'edge_update', 'parent',
                                                        edges_to_stage['parent'])
            if 'children' in edges_to_stage:
                memory_system._stage_memory_unit_update(None, unit_id, 'edge_update', 'children',
                                                        (unit_id, edges_to_stage['children']))
            if 'sequence_pre' in edges_to_stage or 'sequence_next' in edges_to_stage:
                current_pre = memory_system._get_memory_unit(unit_id).pre_id
                current_next = memory_system._get_memory_unit(unit_id).next_id
                new_pre = edges_to_stage.get('sequence_pre', current_pre)
                new_next = edges_to_stage.get('sequence_next', current_next)
                memory_system._stage_memory_unit_update(None, unit_id, 'edge_update', 'sequence', (new_pre, new_next))

            if 'group_id_val' in edges_to_stage or 'rank_val' in edges_to_stage:
                current_rank = memory_system._get_memory_unit(unit_id).rank
                current_group = memory_system._get_memory_unit(unit_id).group_id
                new_rank_val = edges_to_stage.get('rank_val', current_rank)
                new_group_id_val_input = edges_to_stage.get('group_id_val', current_group)
                if new_rank_val == 1:
                    final_group_id_for_staging = _serialize_rank1_group_id(_parse_rank1_group_id(new_group_id_val_input))
                    if len(final_group_id_for_staging) == 1: final_group_id_for_staging = final_group_id_for_staging[0]
                else:
                    if isinstance(new_group_id_val_input, list):
                        final_group_id_for_staging = new_group_id_val_input[0] if new_group_id_val_input else None
                    else:
                        final_group_id_for_staging = new_group_id_val_input
                memory_system._stage_memory_unit_update(None, unit_id, 'edge_update', 'group',
                                                        (final_group_id_for_staging, new_rank_val))
            memory_system._flush_cache(force=True)
            updated_unit = memory_system._get_memory_unit(unit_id)
            return updated_unit.to_dict() if updated_unit else {"error": "Failed to fetch updated unit"}, 200
        except Exception as e:
            print(f"Error updating memory unit {unit_id}: {e}")
            traceback.print_exc()
            return {"error": f"An error occurred: {e}"}, 500

    def _delete_memory_unit_db(unit_id):
        """
        Deletes only the specified MemoryUnit itself and its direct edge relationships.
        It does NOT handle recursive deletion of children or complex application-level rules here.
        """
        global memory_system
        if not memory_system: abort(503, "Memory system not initialized for DB operation.")
        try:
            unit_to_delete = memory_system._get_memory_unit(unit_id)
            if not unit_to_delete:
                return {"error": f"MemoryUnit {unit_id} not found for deletion."}, 404
            memory_system._stage_memory_unit_deletion(unit_id)
            memory_system._flush_cache(force=True)
            return {"message": f"MemoryUnit {unit_id} and its direct edges staged for deletion and flushed."}, 200
        except Exception as e:
            print(f"Error deleting unit {unit_id}: {e}")
            traceback.print_exc()
            return {"error": f"An error occurred: {e}"}, 500

    def _create_session_db(data):
        """Creates a Session using MemorySystem."""
        global memory_system
        if not memory_system: abort(503, "Memory system not initialized for DB operation.")
        try:
            session_id = data.get('session_id', str(uuid.uuid4()))
            if 'session_id' in data: del data['session_id']
            data['id'] = session_id
            session_memory = SessionMemory.from_dict(data)
            memory_system._stage_session_memory_update(session_memory)
            memory_system._flush_cache(force=True)
            session = memory_system._get_session_memory(session_id)
            if session and data.get('memory_unit_ids'):
                for unit_id in data['memory_unit_ids']:
                    _move_unit_to_session_db(session_id, unit_id)

            memory_system._flush_cache(force=True)
            session = memory_system._get_session_memory(session_id)
            return session.to_dict() if session else {"error": "Failed to create/fetch session"}, 201

        except Exception as e:
            print(f"Error creating session via MemorySystem: {e}")
            traceback.print_exc()
            return {"error": f"An error occurred: {e}"}, 500

    def _update_session_db(session_id, data):
        """Updates a Session using MemorySystem."""
        try:
            session = memory_system._get_session_memory(session_id)
            if not session:
                return {"error": "Session not found"}, 404

            old_unit_ids = set(session.memory_unit_ids)
            updated = False

            for field, value in data.items():
                if hasattr(session, field) and field not in ['id']:
                    setattr(session, field, value)
                    updated = True
                if field == 'memory_unit_ids':
                    new_unit_ids = set(data['memory_unit_ids'])
                    added = new_unit_ids - old_unit_ids
                    removed = old_unit_ids - new_unit_ids

                    for unit_id in added:
                        _move_unit_to_session_db(session_id, unit_id)
                    for unit_id in removed:
                        _move_unit_to_session_db(None, unit_id)
            if updated:
                memory_system._stage_session_memory_update(session)
                memory_system._flush_cache(force=True)

            updated_session = memory_system._get_session_memory(session_id)
            return updated_session.to_dict() if updated_session else {"error": "Failed to fetch updated session"}, 200

        except Exception as e:
            print(f"Error updating session {session_id} via MemorySystem: {e}")
            traceback.print_exc()
            return {"error": f"An error occurred: {e}"}, 500

    def _delete_session_db(session_id, delete_units_flag):
        """Deletes a Session using MemorySystem. Always deletes units per rule."""
        if not delete_units_flag:
            print("Warning: 'delete_units=false' requested, but MemorySystem.remove_session always deletes units.")

        try:
            memory_system.remove_session(session_id)
            return {"message": f"Session {session_id} and its units/summaries deleted."}, 200

        except Exception as e:
            print(f"Error deleting session {session_id} via MemorySystem: {e}")
            traceback.print_exc()
            return {"error": f"An error occurred: {e}"}, 500

    def _move_unit_to_session_db(target_session_id, unit_id):
        """Moves a unit to a different session using MemorySystem."""
        try:
            unit = memory_system._get_memory_unit(unit_id)
            if not unit: return {"error": "MemoryUnit not found"}, 404
            if unit.rank != 0: return {"error": "Only rank 0 units can be moved"}, 400
            old_session_id = unit.group_id

            if old_session_id != target_session_id:
                memory_system._stage_memory_unit_update(None, operation='edge_update', update_type='group', update_details=(target_session_id, unit.rank))
                memory_system._flush_cache(force=True)
            return {"message": f"MemoryUnit {unit_id} moved to Session {target_session_id}"}, 200

        except Exception as e:
            print(f"Error moving unit {unit_id} via MemorySystem: {e}")
            traceback.print_exc()
            return {"error": f"An error occurred: {e}"}, 500

    def _create_ltm_db(data):
        """Creates an LTM using MemorySystem."""
        try:
            ltm_id = data.get('ltm_id')
            if not ltm_id: return {"error": "LTM id was not provided."}, 500
            if 'ltm_id' in data: del data['ltm_id']
            data['id'] = ltm_id
            session_ids = data.get('session_ids', [])
            summary_ids = data.get('summary_unit_ids', [])
            ltm = LongTermMemory.from_dict(data)
            memory_system._stage_long_term_memory_update(ltm)
            if session_ids:
                _add_sessions_to_ltm_db(ltm_id, session_ids)
            if summary_ids:
                _move_units_to_ltm_db(ltm_id, summary_ids)
            memory_system._flush_cache(force=True)
            new_ltm = memory_system._get_long_term_memory(ltm_id)
            return new_ltm.to_dict() if new_ltm else {"error": "Failed to create LTM"}, 201

        except Exception as e:
            print(f"Error creating LTM via MemorySystem: {e}")
            traceback.print_exc()
            return {"error": f"An error occurred: {e}"}, 500

    def _update_ltm_db(ltm_id, data):
        try:
            ltm = memory_system._get_long_term_memory(ltm_id)
            if not ltm: return {"error": "LTM not found"}, 404
            if 'last_session_id' in data: ltm.last_session_id = data['last_session_id']
            if 'session_ids' in data:
                old_s_ids = set(ltm.session_ids or [])
                new_s_ids = set(data.get('session_ids',[]))
                ltm.session_ids = list(new_s_ids)
                for sid in new_s_ids - old_s_ids:
                    u = memory_system._get_memory_unit(sid)
                    if u and u.rank==1:
                        g = _parse_rank1_group_id(u.group_id)
                        g.add(ltm_id)
                        g = _serialize_rank1_group_id(g)
                        if len(g) == 1: g = g[0]
                        memory_system._stage_memory_unit_update(None,sid,'edge_update','group',(g,1))
                for sid in old_s_ids - new_s_ids:
                    u = memory_system._get_memory_unit(sid)
                    if u and u.rank==1:
                        g = _parse_rank1_group_id(u.group_id)
                        g.discard(ltm_id)
                        g = _serialize_rank1_group_id(g)
                        if len(g) == 1: g = g[0]
                        memory_system._stage_memory_unit_update(None,sid,'edge_update','group',(g,1))

            if 'summary_unit_ids' in data:
                old_sum_ids = set(ltm.summary_unit_ids or [])
                new_sum_ids = set(data.get('summary_unit_ids',[]))
                ltm.summary_unit_ids = list(new_sum_ids)
                for uid in new_sum_ids - old_sum_ids:
                    u = memory_system._get_memory_unit(uid)
                    if u and u.rank==1:
                        g = _parse_rank1_group_id(u.group_id)
                        g.add(ltm_id)
                        g = _serialize_rank1_group_id(g)
                        if len(g) == 1: g = g[0]
                        memory_system._stage_memory_unit_update(None,uid,'edge_update','group',(g,1))
                for uid in old_sum_ids - new_sum_ids: # Removed
                    u = memory_system._get_memory_unit(uid)
                    if u and u.rank==1:
                        g = _parse_rank1_group_id(u.group_id)
                        g.discard(ltm_id)
                        g = _serialize_rank1_group_id(g)
                        if len(g) == 1: g = g[0]
                        memory_system._stage_memory_unit_update(None,uid,'edge_update','group',(g,1))

            memory_system._stage_long_term_memory_update(ltm)
            memory_system._flush_cache(force=True)
            updated_ltm = memory_system._get_long_term_memory(ltm_id)
            return updated_ltm.to_dict() if updated_ltm else {"error": "Failed to fetch updated LTM"}, 200
        except Exception as e:
            print(f"Error updating LTM {ltm_id}: {e}"); traceback.print_exc()
            return {"error": f"An error occurred: {e}"}, 500

    def _delete_ltm_db(ltm_id):
        """Deletes LTM summaries and LTM record using MemorySystem."""
        try:
            ltm = memory_system._get_long_term_memory(ltm_id)
            if not ltm: return {"error": "LTM not found"}, 404

            summaries_to_delete = set(ltm.summary_unit_ids)
            summaries_to_delete.add(ltm_id)
            deleted_ids = set()
            async def _delete_task():
                for unit_id in list(summaries_to_delete):
                    await memory_system._stage_memory_unit_deletion(unit_id)

                for session_id in ltm.session_ids:
                    session_summary = await memory_system._async_system._get_memory_unit(session_id)
                    if session_summary and session_summary.rank == 1:
                        group_ids = session_summary.group_id
                        if isinstance(group_ids, list) and ltm_id in group_ids:
                            group_ids.remove(ltm_id)
                            await memory_system._async_system._stage_memory_unit_update(
                                None, session_id, 'edge_update', 'group', (group_ids, 1)
                            )
                        elif group_ids == ltm_id:
                            await memory_system._async_system._stage_memory_unit_update(
                                None, session_id, 'edge_update', 'group', (None, 1)
                            )

                memory_system.delete_ltm(ltm_id)
                await memory_system._async_system._flush_cache(force=True)
                return {"message": f"LTM {ltm_id} summaries deleted. Deleted IDs: {list(deleted_ids)}"}, 200

            result, status_code = memory_system._run_async_delegate(_delete_task)
            return result, status_code

        except Exception as e:
            print(f"Error deleting LTM {ltm_id} via MemorySystem: {e}")
            traceback.print_exc()
            return {"error": f"An error occurred: {e}"}, 500

    def _add_sessions_to_ltm_db(ltm_id, session_ids_to_add):
        try:
            ltm = memory_system._get_long_term_memory(ltm_id)
            if not ltm: return {"error": "LTM not found"}, 404
            updated_ltm_obj = False
            for session_id in session_ids_to_add:
                if session_id not in ltm.session_ids:
                    ltm.session_ids.append(session_id)
                    updated_ltm_obj = True
                unit = memory_system._get_memory_unit(session_id)
                if unit and unit.rank == 1:
                    current_ltm_groups = _parse_rank1_group_id(unit.group_id)
                    if ltm_id not in current_ltm_groups:
                        current_ltm_groups.add(ltm_id)
                        new_group = _serialize_rank1_group_id(current_ltm_groups)
                        memory_system._stage_memory_unit_update(None, session_id, 'edge_update', 'group', (new_group, 1))
            if updated_ltm_obj:
                memory_system._stage_long_term_memory_update(ltm)
            memory_system._flush_cache(force=True)
            return {"message": f"Sessions processed for LTM {ltm_id}"}, 200
        except Exception as e:
            print(f"Error adding sessions to LTM: {e}"); traceback.print_exc()
            return {"error": f"An error occurred: {e}"}, 500

    def _move_units_to_ltm_db(ltm_id, unit_ids_to_add):
        """Adds summary units to an LTM using MemorySystem."""
        try:
            ltm = memory_system._get_long_term_memory(ltm_id)
            if not ltm: return {"error": "LTM not found"}, 404
            current_units = set(ltm.summary_unit_ids)
            new_units = current_units | set(unit_ids_to_add)
            ltm.summary_unit_ids = list(new_units)

            for unit_id in unit_ids_to_add:
                memory_system._stage_memory_unit_update(None, unit_id, 'edge_update', 'group', (ltm_id, 1))
            memory_system._stage_long_term_memory_update(ltm)
            memory_system._flush_cache(force=True)
            return {"message": f"Sessions processed for LTM {ltm_id}"}, 200
        except Exception as e:
            print(f"Error adding sessions to LTM: {e}"); traceback.print_exc()
            return {"error": f"An error occurred: {e}"}, 500

    def _batch_delete_units_db(unit_ids):
        """Batch deletes units using MemorySystem."""
        try:
            deleted_set = set()
            async def _batch_delete_task():
                for unit_id in unit_ids:
                    await memory_system._async_system._stage_memory_unit_deletion(unit_id)
                memory_system._flush_cache(force=True)
                return {"message": f"Batch delete processed. Deleted IDs: {list(deleted_set)}"}, 200

            result, status_code = memory_system._run_async_delegate(_batch_delete_task)
            return result, status_code

        except Exception as e:
            print(f"Error batch deleting units via MemorySystem: {e}")
            traceback.print_exc()
            return {"error": f"An error occurred: {e}"}, 500

    def _get_all_from_sqlite(loader_func_name: str, *args):
        """Helper to run AsyncSQLiteHandler load methods."""
        global memory_system
        if not memory_system or not hasattr(memory_system, '_run_async_delegate'):
             abort(503, "Memory system not capable of running async delegate for SQLite load.")

        async def _task():
            handler = memory_system._async_system.sqlite_handler
            if not handler:
                return {"error": "SQLite handler not available"}, 500
            loader_func = getattr(handler, loader_func_name)
            result_dict = await loader_func(*args)
            return [v.to_dict() for v in result_dict.values()], 200
        try:
            return memory_system._run_async_delegate(_task)
        except Exception as e:
             return {"error": f"Failed to load data: {e}"}, 500

    @bp.route('/memory_units', methods=['GET'])
    def get_all_memory_units():
        """Gets all memory units (no filtering yet)."""
        _get_shared_memory_system_and_check_status(for_write_operation=False)
        result, status_code = _get_all_from_sqlite('load_all_memory_units', True)
        return jsonify(result), status_code

    @bp.route('/sessions', methods=['GET'])
    def get_all_sessions():
        """Gets all sessions."""
        _get_shared_memory_system_and_check_status(for_write_operation=False)
        result, status_code = _get_all_from_sqlite('load_all_session_memories', True)
        return jsonify(result), status_code

    @bp.route('/ltms', methods=['GET'])
    def get_all_ltms():
        """Gets all LTMs."""
        current_memory_system = _get_shared_memory_system_and_check_status(for_write_operation=False)
        chatbot_id_for_ltm = current_memory_system._async_system.chatbot_id if current_memory_system._async_system else None
        if not chatbot_id_for_ltm:
            return jsonify({"error": "Could not determine chatbot_id for LTM loading"}), 500
        result_payload, status_code = _get_all_from_sqlite('load_all_long_term_memories_for_chatbot', chatbot_id_for_ltm, True)
        return jsonify(result_payload), status_code

    @bp.route('/memory_units/<unit_id>', methods=['GET'])
    def get_single_memory_unit_api(unit_id):
        """Gets a single memory unit."""
        memory_system = _get_shared_memory_system_and_check_status(for_write_operation=False)
        unit = memory_system._get_memory_unit(unit_id)
        return jsonify(unit.to_dict()) if unit else ({"error": "MemoryUnit not found"}, 404)

    @bp.route('/sessions/<session_id>', methods=['GET'])
    def get_single_session(session_id):
        """Gets a single session."""
        memory_system = _get_shared_memory_system_and_check_status(for_write_operation=False)
        session = memory_system._get_session_memory(session_id)
        if session:
            data = session.to_dict()
            units = memory_system._load_memory_units(session.memory_unit_ids)
            data['units_preview'] = [
                {"id": u.id, "content": u.content[:50] + '...', "rank": u.rank}
                for u in units.values()
            ]
            return jsonify(data)
        return {"error": "SessionMemory not found"}, 404

    @bp.route('/ltms/<ltm_id>', methods=['GET'])
    def get_single_ltm(ltm_id):
        """Gets a single LTM."""
        memory_system = _get_shared_memory_system_and_check_status(for_write_operation=False)
        ltm = memory_system._get_long_term_memory(ltm_id)
        return jsonify(ltm.to_dict()) if ltm else ({"error": "LongTermMemory not found"}, 404)

    # --- POST/PUT/DELETE Enqueueing Endpoints ---
    @bp.route('/memory_units', methods=['POST'])
    def create_memory_unit_task():
        """Enqueues a task to create a MemoryUnit."""
        _get_shared_memory_system_and_check_status(for_write_operation=True)
        data = request.json
        if not data or 'content' not in data:
            return jsonify({"error": "Content is required"}), 400
        desc = f"Create Memory Unit: {data.get('content', '')[:30]}..."
        task_id = enqueue_task(_create_memory_unit_db, desc, data)
        return jsonify({"message": "Create Memory Unit task queued", "task_id": task_id, "description": desc}), 202

    @bp.route('/memory_units/<unit_id>', methods=['PUT'])
    def update_memory_unit_task(unit_id):
        """Enqueues a task to update a MemoryUnit."""
        _get_shared_memory_system_and_check_status(for_write_operation=True)
        data = request.json
        if not data:
            return jsonify({"error": "No update data provided"}), 400
        desc = f"Update Memory Unit: {unit_id}"
        task_id = enqueue_task(_update_memory_unit_db, desc, unit_id, data)
        return jsonify({"message": "Update Memory Unit task queued", "task_id": task_id, "description": desc}), 202

    @bp.route('/memory_units/<unit_id>', methods=['DELETE'])
    def delete_memory_unit_task(unit_id):
        """Enqueues a task to delete a MemoryUnit."""
        _get_shared_memory_system_and_check_status(for_write_operation=True)
        desc = f"Delete Memory Unit: {unit_id}"
        task_id = enqueue_task(_delete_memory_unit_db, desc, unit_id)
        return jsonify({"message": "Delete Memory Unit task queued", "task_id": task_id, "description": desc}), 202

    @bp.route('/sessions', methods=['POST'])
    def create_session_task():
        """Enqueues a task to create a Session."""
        _get_shared_memory_system_and_check_status(for_write_operation=True)
        data = request.json or {}
        desc = f"Create Session Memory"
        task_id = enqueue_task(_create_session_db, desc, data)
        return jsonify({"message": "Create Session task queued", "task_id": task_id, "description": desc}), 202

    @bp.route('/sessions/<session_id>', methods=['PUT'])
    def update_session_task(session_id):
        """Enqueues a task to update a Session."""
        _get_shared_memory_system_and_check_status(for_write_operation=True)
        data = request.json
        if not data:
            return jsonify({"error": "No update data provided"}), 400
        desc = f"Update Session Memory: {session_id}"
        task_id = enqueue_task(_update_session_db, desc, session_id, data)
        return jsonify({"message": "Update Session task queued", "task_id": task_id, "description": desc}), 202

    @bp.route('/sessions/<session_id>', methods=['DELETE'])
    def delete_session_task(session_id):
        """Enqueues a task to delete a Session."""
        _get_shared_memory_system_and_check_status(for_write_operation=True)
        delete_units_flag = request.args.get('delete_units', 'true').lower() == 'true'
        desc = f"Delete Session Memory: {session_id} (Units will be deleted)"
        task_id = enqueue_task(_delete_session_db, desc, session_id, delete_units_flag)
        return jsonify({"message": "Delete Session task queued", "task_id": task_id, "description": desc}), 202

    @bp.route('/sessions/<target_session_id>/move_unit/<unit_id>', methods=['POST'])
    def move_unit_to_session_task(target_session_id, unit_id):
        """Enqueues a task to move a unit to a session."""
        _get_shared_memory_system_and_check_status(for_write_operation=True)
        desc = f"Move Memory Unit {unit_id} to Session {target_session_id}"
        task_id = enqueue_task(_move_unit_to_session_db, desc, target_session_id, unit_id)
        return jsonify({"message": "Move Unit task queued", "task_id": task_id, "description": desc}), 202

    @bp.route('/ltms', methods=['POST'])
    def create_ltm_task():
        """Enqueues a task to create an LTM."""
        _get_shared_memory_system_and_check_status(for_write_operation=True)
        data = request.json
        if not data: return jsonify({"error": "Data is required"}), 400
        desc = f"Create Long Term Memory"
        task_id = enqueue_task(_create_ltm_db, desc, data)
        return jsonify({"message": "Create LTM task queued", "task_id": task_id, "description": desc}), 202

    @bp.route('/ltms/<ltm_id>', methods=['PUT'])
    def update_ltm_task(ltm_id):
        """Enqueues a task to update an LTM."""
        _get_shared_memory_system_and_check_status(for_write_operation=True)
        data = request.json
        if not data: return jsonify({"error": "No update data provided"}), 400
        desc = f"Update Long Term Memory: {ltm_id}"
        task_id = enqueue_task(_update_ltm_db, desc, ltm_id, data)
        return jsonify({"message": "Update LTM task queued", "task_id": task_id, "description": desc}), 202

    @bp.route('/ltms/<ltm_id>', methods=['DELETE'])
    def delete_ltm_task(ltm_id):
        """Enqueues a task to delete an LTM and its summaries."""
        _get_shared_memory_system_and_check_status(for_write_operation=True)
        desc = f"Delete Long Term Memory: {ltm_id} (and summaries)"
        task_id = enqueue_task(_delete_ltm_db, desc, ltm_id)
        return jsonify({"message": "Delete LTM task queued", "task_id": task_id, "description": desc}), 202

    @bp.route('/ltms/<ltm_id>/add_sessions', methods=['POST'])
    def add_sessions_to_ltm_task(ltm_id):
        """Enqueues a task to add sessions to an LTM."""
        _get_shared_memory_system_and_check_status(for_write_operation=True)
        data = request.json
        session_ids = data.get('session_ids')
        if not session_ids or not isinstance(session_ids, list):
            return jsonify({"error": "List of session_ids is required"}), 400
        desc = f"Add {len(session_ids)} sessions to LTM {ltm_id}"
        task_id = enqueue_task(_add_sessions_to_ltm_db, desc, ltm_id, session_ids)
        return jsonify({"message": "Add Sessions to LTM task queued", "task_id": task_id, "description": desc}), 202

    @bp.route('/batch/delete_units', methods=['POST'])
    def batch_delete_units_task():
        """Enqueues a task to batch delete units."""
        _get_shared_memory_system_and_check_status(for_write_operation=True)
        data = request.json
        unit_ids = data.get('ids')
        if not unit_ids or not isinstance(unit_ids, list):
            return jsonify({"error": "Invalid or empty list of unit IDs provided"}), 400
        desc = f"Batch delete {len(unit_ids)} memory units"
        task_id = enqueue_task(_batch_delete_units_db, desc, unit_ids)
        return jsonify({"message": "Batch Delete Units task queued", "task_id": task_id, "description": desc}), 202

    @bp.route('/close', methods=['POST'])
    def close_endpoint():
        global memory_system
        with current_app.config['CHATBOT_STATUS_LOCK']:
            current_status = current_app.config.get('CHATBOT_STATUS')
            if current_status == 'memory_editing':
                current_app.config['CHATBOT_STATUS'] = 'closed'
                print("MemoryEditor: User finished editing. Status changed from 'memory_editing' to 'closed'.")
                return jsonify({"status": "Memory editing session finished. Chatbot can now be re-initialized."}), 200
            elif current_status == 'closed':
                return jsonify({"status": "Memory editor was already in a 'closed' state."}), 200
            else:
                return jsonify({
                    "message": f"Memory editor session close requested, but system status is '{current_status}'. No change made.",
                    "status": current_status
                }), 200
    return bp