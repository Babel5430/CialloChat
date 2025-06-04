import itertools
from collections import defaultdict
import json

def parse_entity_attr(entity, role_name, source_role = None):
    if not source_role:
        source_role = role_name
    prefix = ""
    if source_role != role_name:
        prefix = f"{source_role}对{role_name}的认识:"
    all_attr = defaultdict(list)
    attributes = entity.get("attributes", {})
    if not attributes:
        print("\b not attrs. \n")
        pass
    else:
        for attr_name, descriptions in attributes.items():
            if not descriptions:
                continue
            else:
                for desc in descriptions:
                    if not desc.get("description", None):
                        continue
                    access = desc.get("access_rights", "unlimited")
                    if isinstance(access, list):
                        if source_role in access:
                            all_attr[attr_name].append(prefix + f"{role_name}的{attr_name}包括: " + desc['description'])
                    elif isinstance(access, str):
                        if (not access or access == "unlimited" or access == source_role):
                            all_attr[attr_name].append(prefix + f"{role_name}的{attr_name}包括: " + desc['description'])
    return all_attr

def get_entity_attr(rg_path,role_name):
    try:
        with open(rg_path, 'r', encoding='utf-8') as f:
            rg = json.load(f)
        entity = rg['roles'].get(role_name)
        # print(entity)
        if not entity:
            return {}
        all_attr = parse_entity_attr(entity,role_name)
        ideas_to_others = entity.get('ideas')
        for other_role,ideas in ideas_to_others.items():
            all_attr[f'idea_to-{other_role}'] = [f"{role_name}对{other_role}想法包括: " + '; '.join(ideas)] if ideas is not None else []
            other_entity = rg.get(other_role,None)
            if other_entity:
                others_attr = parse_entity_attr(entity,other_role,role_name)
                all_attr[f'idea_to-{other_role}'].extend(list(itertools.chain(others_attr.values())))

        return all_attr

    except Exception as e:
        raise ValueError(e)