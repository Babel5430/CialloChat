# CialloChat 自定义角色指南 🧑‍🎨

想亲手创造一个有人格、有记忆的角色吗？ CialloChat 将为你提供有力支持！不过，这个过程需要你对 Python 编程有一些基础了解，并且不害怕跟代码打交道。如果你已经跃跃欲试，那就来吧！

---

## 准备工作

1.  **Python 环境**：尽管 CialloChat 支持动态导入脚本所以可以不配置环境，但为了实现更精妙的功能，安装 Python 并亲自动手无疑是更好的选择。你的电脑上建议安装 Python。如果还没有，可以去 Python 官方网站 (python.org) 下载并安装一个稳定版本 (推荐 Python 3.11 或更高版本)。
2.  **CialloChat 项目文件**：确保你已经下载并解压了 CialloChat 的完整项目文件。

## 创建你的角色

1.  **新建角色专属文件夹**：
    * 在 CialloChat 项目的根目录下 (也就是 `CialloChat.exe` 所在的那个目录)，找到一个名为 `Characters` 的文件夹。
    * 在 `Characters` 文件夹里面，**新建一个文件夹**。这个新文件夹将存放全部角色信息，**建议使用英文或拼音命名，并且不要包含空格或特殊字符**，例如 `Yoshino` 或 `Yvyve`。这能避免很多奇奇怪怪的路径问题。

2.  **准备核心文件**：
    在你刚刚创建的角色专属文件夹 (例如 `Yoshino`) 里，你需要手动创建以下两个核心文件：
    * `feature_function.py`：这是角色的“**核心逻辑脚本**”。它是一个 Python 文件，定义了AI角色的一些关键行为和初始化方式。
    * `config.json`：这是角色的“**专属配置文件**”。它是一个 JSON 格式的文件，用来存放与该角色相关的各种配置信息，比如AI模型的参数、图片路径等。

### (a) 编写 `feature_function.py` (角色核心逻辑)

这个 Python 文件 (`.py` 后缀) 必须包含以下三个特定名称的函数定义。你需要根据自己的需求，参考示例并修改这些函数内部的具体实现代码。

```python
# feature_function.py

# 导入必要的模块，这些通常是CialloChat框架提供或你选择的第三方库
import os # 操作系统相关的路径处理可能会用到
# from CialloChat.core.workflow import RolePlayChatbot # 导入核心的聊天机器人基类
# from CialloChat.utils import ChatDS # 导入你选择的语言模型接口，例如ChatDS对应DeepSeek
# from MemForest.manager import MemorySystem # 导入记忆系统管理器

# 【重要】请确保以下导入路径与你的项目实际结构一致
# 如果提示找不到模块，你需要检查这些类和函数是否在正确的路径下，或者是否需要安装某些依赖库

def init_chatbot(**kwargs):
    """
    初始化聊天机器人实例的函数。
    程序启动并选择此角色时，会调用这个函数来创建和配置角色扮演聊天机器人的实例。
    传入的 kwargs 参数字典会从该角色专属的 config.json 文件中 CHATBOT -> INIT_CONFIG 部分自动读取。

    你需要在此函数中完成：
    1. 导入 RolePlayChatbot 类 (例如: from CialloChat.core.workflow import RolePlayChatbot)。
    2. 导入并初始化你选用的语言模型 (LLM) 封装类 (例如: ChatDS for DeepSeek, from CialloChat.utils import ChatDS)。
    3. 导入并初始化记忆系统类 (例如: MemorySystem, from MemForest.manager import MemorySystem)。
    4. 根据 kwargs 中的配置项 (如 api_key, base_url, model_name 等) 初始化上述 LLM 和记忆系统。
    5. 创建并返回一个 RolePlayChatbot 的实例。

    【关键】此函数最后必须 `return` 一个 RolePlayChatbot 类的实例对象！
    """
    # --- 示例代码开始 (你需要根据你的项目结构和实际情况进行修改) ---
    # 实际使用时，请取消下面真实导入语句的注释，并确保它们能正确工作
    from CialloChat.core.workflow import RolePlayChatbot # 假设的导入路径
    from CialloChat.utils import ChatDS             # 假设的导入路径
    from MemForest.manager import MemorySystem      # 假设的导入路径

    # 1. 初始化语言模型 (LLM)
    # 从 kwargs 中安全地获取模型配置参数，可以提供默认值
    llm_api_key = kwargs.get("api_key", os.environ.get("API_KEY",""))
    llm_base_url = kwargs.get("base_url")
    llm_model_name = kwargs.get("model_name", "deepseek-chat") # 若未配置则使用默认模型
    llm_temperature = float(kwargs.get("temperature", 0.3)) # 温度值确保为浮点数

    if not llm_api_key or not llm_base_url:
        raise ValueError("API key 和 base_url 未在 config.json 中正确配置！")

    my_llm = ChatDS( # 使用你选择的LLM封装类
        api_key=llm_api_key,
        base_url=llm_base_url,
        model_name=llm_model_name,
        temperature=llm_temperature
        # ... 其他LLM初始化时需要的参数
    )

    # 2. 初始化记忆系统
    memory_db_path = kwargs.get("memory_db_path", "memory.db") # 记忆数据库路径
    # memory_db_path 可以包含 {DATA_DIR} 占位符，系统将自动进行替换



    memory_system_instance = MemorySystem(
        # 填写关键参数，详见项目“Memory_System”
    )

    # 3. 获取角色核心设定 (名称, 用户称呼, 属性等)
    role_name = kwargs.get("role_name", "ai") # 从配置或默认
    user_name = kwargs.get("user_name", "user")     # 默认称呼用户为“[USER_NAME]”

    # entity_attr, query_schema, answer_schema 通常定义了角色的具体属性、
    # 如何理解特定类型的用户提问，以及如何以特定风格回答。
    # 这些复杂数据建议从专门的JSON文件（例如角色图谱文件）加载，而不是直接写入config。
    # 此处仅为最简化示例，实际应用中应有更完善的加载逻辑。
    # 例如，从 config.json 中读取 entity_attr, query_schema, answer_schema 的文件路径，然后加载它们。
    entity_attr = kwargs.get("entity_attr", {"基本设定": [f"{role_name}是一个友好的AI助手。"]})
    query_schema = kwargs.get("query_schema", {"打招呼": ["你好", "在吗"]})
    answer_schema = kwargs.get("answer_schema", {"回应打招呼": [f"你好呀，{user_name}！很高兴认识你。"]})
    
    # 角色初始描述，也会影响AI的第一印象
    initial_role_description = kwargs.get("initial_role_description", f"现在你将扮演{role_name}。{role_name}的设定是：温和、友善，乐于助人。")


    # 4. 创建并返回 RolePlayChatbot 实例
    chatbot_instance = RolePlayChatbot(
        llm=my_llm,
        role=role_name,
        user=user_name,
        role_description=initial_role_description, # 初始的角色扮演指示
        entity_attr=entity_attr,
        query_schema=query_schema,
        answer_schema=answer_schema,
        memory_system=memory_system_instance,
        max_ctx_len=int(kwargs.get("max_context_length", 10)), # 最大上下文长度 (对话轮次)
        summarizing_prompt=kwargs.get("summarizing_prompt", "请你简要总结一下我们刚才的对话内容，重点是：") # 对话总结的提示
    )
    print(f"自定义角色 {role_name} 初始化成功！准备就绪。")
    return chatbot_instance
    # --- 示例代码结束 ---


def get_role_desc(round: int, user_input: str, **kwargs) -> str:
    """
    动态生成或调整当前角色描述的函数。
    在每一轮对话中，用户输入之后、AI生成回复之前，这个函数会被调用。
    它允许你根据当前的对话轮次 (round)、用户的最新输入 (user_input)
    以及从 config.json 的 CHATBOT -> ROLE_CONFIG 部分传入的额外参数 (kwargs)
    来动态地调整AI当前应当遵循的角色描述。
    这对于实现角色情绪变化、状态改变、或对特定话题的反应非常有用。

    Args:
        round (int): 当前对话的轮次，从0开始计数。
        user_input (str): 用户刚刚发送的最新一条消息。
        **kwargs: 从 config.json -> CHATBOT -> ROLE_CONFIG 中读取的自定义参数。

    Returns:
        str: 返回一个字符串，作为当前AI应该扮演的角色描述。
    """
    # --- 示例代码开始 (你可以根据自己的角色需求进行修改) ---
    # 从kwargs获取基础描述，或者在config.json的ROLE_CONFIG里定义
    base_description = kwargs.get("base_description", "我是一个乐于助人的AI伙伴。")
    role_name = kwargs.get("role_name_in_desc", "我") # 角色在描述中如何自称

    current_description = f"现在你扮演{role_name}。{base_description}"

    if round == 0: # 第一轮对话
        return f"{current_description} 你好呀！我们开始聊天吧！"
    elif "谢谢" in user_input or "感谢" in user_input:
        return f"{current_description} 不客气，能帮到你就好！"
    elif "再见" in user_input or "拜拜" in user_input:
        return f"{current_description} 嗯，期待下次再聊！"
    else: # 其他情况，可以根据用户输入包含的关键词等来改变描述
        # 例如：if "悲伤" in user_input: return f"{current_description} 我感受到你有些低落，想和我说说吗？"
        return f"{current_description} 我在认真听你讲。"
    # --- 示例代码结束 ---


def get_image_file_path(response: dict) -> list[str]:
    """
    根据AI生成的回复内容，决定在界面上显示哪张角色图片。
    这个函数在AI的回复已经生成之后，展示给用户之前被调用。

    Args:
        response (dict): 一个包含AI完整回复的字典，通常由 RolePlayChatbot.chat() 方法返回。
                         关键字段可能包括:
                         - "speak": AI角色说的话 (string)
                         - "think": AI角色的内心活动/思考过程 (string, 如果暴露模式开启)
                         - "desc":  AI对当前场景的描述 (string, 如果暴露模式开启)
                         - 可能还有其他自定义字段，例如情绪标签等。

    Returns:
        list[str]: 一个包含图片文件【绝对路径】或【相对于CialloChat项目根目录的相对路径】的列表。
                   - 如果不想显示任何图片，或者当前没有合适的图片，返回一个空列表 `[]`。
                   - 如果列表中包含多张图片路径，前端可能会按顺序播放它们，形成简单动画效果。
                   - 示例: `["Characters/Akari/images/happy.png"]`
                            `["C:/Users/User/Documents/CialloChat/Characters/Akari/images/wink.png"]`
    """
    # --- 示例代码开始 (你需要根据自己的角色和图片资源进行修改) ---
    # 首先，获取AI说的话和思考的内容，方便后续判断
    speak_content = response.get("speak", "").lower() # 转为小写以便关键词匹配
    think_content = response.get("think", "").lower()

    # 定义图片文件路径。强烈建议在 config.json 中配置图片的基础路径，
    # 然后在这里通过 kwargs 传入，或者基于角色文件夹动态构建。
    # 【重要】下面的路径只是示例，你需要替换成你角色图片的真实有效路径！
    # 假设你的图片都放在角色文件夹下的 "images" 子目录中
    # 例如: CialloChat_Project_Root/Characters/Akari/images/default.png

    # 更好的做法是，在config.json的CHATBOT部分定义一个 "image_base_path"
    # image_base_path = kwargs.get("image_base_path", f"Characters/Akari/images")
    # pic_default = os.path.join(image_base_path, "default.png")
    # pic_happy   = os.path.join(image_base_path, "happy.png")
    # pic_sad     = os.path.join(image_base_path, "sad.png")
    # pic_angry   = os.path.join(image_base_path, "angry.png")

    # 【请务必修改以下路径为你自己图片的实际路径！】
    # 你需要确保这些路径指向真实存在的图片文件。
    # 路径可以是相对于项目根目录的相对路径，或者是绝对路径。
    # 为了方便管理，推荐使用相对路径，并把图片放在角色文件夹内。
    character_name = "Kaguya" # 假设这是你的角色文件夹名
    pic_default = f"Characters/{character_name}/images/default.png"
    pic_happy   = f"Characters/{character_name}/images/happy.png"
    pic_sad     = f"Characters/{character_name}/images/sad.png"

    # 检查默认图片是否存在，如果不存在或未配置，则不显示任何图片
    # (更严谨的检查是 os.path.exists(pic_default) 但这要求路径在执行时已转换为绝对路径或相对于当前工作目录)
    # 简单起见，我们假设路径在前端能被正确解析
    if not pic_default:
        return []

    # 根据AI回复中的关键词或情绪（可以让AI能输出情绪标签，甚至基于文本查询图片）来选择图片
    if any(keyword in speak_content or keyword in think_content for keyword in ["开心", "高兴", "哈哈", "XD", ":)"]):
        return [pic_happy] if pic_happy else [pic_default] # 如果开心图不存在，用默认图
    elif any(keyword in speak_content or keyword in think_content for keyword in ["难过", "伤心", "呜呜", "T_T", ":("]):
        return [pic_sad] if pic_sad else [pic_default]

    # 如果没有匹配到特定情绪，则显示默认图片
    return [pic_default]
    # --- 示例代码结束 ---
```

---

**重要提示：**
* `init_chatbot` 函数是整个自定义角色的入口和核心，它负责创建和配置你角色的所有组件。你需要根据你实际使用的 LLM (大语言模型) 服务、记忆系统的具体API和初始化要求来仔细修改它。示例中使用了 CialloChat 内置的 `ChatDS` 和 `MemorySystem` 类。
* `get_role_desc` 函数能让你动态地改变AI在对话中扮演的“角色卡”或“当前状态”，AI会根据这个描述来调整其行为和回复。
* `get_image_file_path` 函数用于根据AI的回复内容，智能地切换界面上显示的角色图片，增加互动的生动感。你需要提供图片文件的真实有效路径。路径可以是绝对路径 (例如 `C:\MyProjects\CialloChat\Characters\Reina\images\happy.png`)，或者是相对于 **CialloChat 项目根目录** 的相对路径 (例如 `Characters/Reina/images/happy.png`)。**推荐将图片放在角色自己的文件夹内，并使用相对路径，方便移植和分享。**

### (b) 编写 `config.json` (角色专属配置)

这是一个 JSON 格式（`.json` 后缀）的文本文件，用于存放你自定义角色的各种静态配置信息。你需要参考项目提供的默认 `config.json` (通常可能在 `Characters/meguru/config.json` 或者项目根目录下的 `default_config.json`，具体位置请查看你的项目包) 的结构和字段，来为你自己的角色创建和修改这个文件。

**关键配置项解读：**

* `"DATA_DIR": "."`: 这个通常表示数据目录的根路径， `.` 代表当前角色文件夹。在代码中， `{DATA_DIR}` 占位符会被替换成实际的角色文件夹路径。
* `CHATBOT` -> `INIT_CONFIG`: 这里是初始化 `RolePlayChatbot` 实例所需的大部分参数。
    * `api_key`, `base_url`, `model_name`: 与主 `README.md` 中说明的一致，填写你选择的AI模型服务商提供的信息。**这些信息是针对你这个特定角色的，可以与其他角色使用不同的模型或API Key。**
    * `temperature`: 控制AI回复的创新性/随机性，参考进阶使用说明。
    * `memory_db_path`: 角色专属记忆数据库文件的存放路径。推荐使用 `{DATA_DIR}/memory.db` 或 `{DATA_DIR}/[角色名]_memory.db`，这样记忆文件会保存在角色自己的文件夹里。
    * `role_graph_path`: （如果使用）角色图谱数据文件的路径，例如 `{DATA_DIR}/graph_data.json`。
    * `role_name`: 你定义角色的名字，应与 `init_chatbot` 函数中使用的角色名一致。
    * `user_name`: 你希望AI在对话中如何称呼用户。
    * `max_context_length`: 角色的短期记忆长度（通常指对话轮次）。
    * `entity_attr`, `query_schema`, `answer_schema`: 这些是更高级的角色定义，可以按需配置。如果简单角色用不上，可以提供空字典 `{}` 或在 `init_chatbot` 中设置默认值。如果内容复杂，建议将它们单独存放在JSON文件中，然后在 `INIT_CONFIG` 中配置这些JSON文件的路径，再由 `init_chatbot` 函数读取。
    * `initial_role_description`: 定义角色初次加载时的基础扮演指令。
* `CHATBOT` -> `DEFAULT_IMAGE`: 角色在没有特定情绪或场景匹配时，默认显示的角色图片路径。例如：`"Characters/Reina/images/default.png"`。
* `CHATBOT` -> `DEFAULT_BG_IMAGE`: (可选) 默认的聊天背景图片路径。
* `CHATBOT` -> `ROLE_CONFIG`: (可选) 这是一个自定义字典，你可以在这里存放一些 `get_role_desc` 函数可能会用到的固定配置参数，例如基础描述文本、角色情绪列表等。
* `CHATBOT` -> `CHAT_CONFIG`: 存放对话进行时的一些配置，比如总结功能的提示词、记忆检索数量等 (参考进阶使用文档)。
* `ROLE_GRAPH`, `STANDARD_QUERY`, `STANDARD_ANSWER`, `MEMORY_EDITOR`: 这些是其他高级功能模块的配置，路径也推荐使用 `{DATA_DIR}` 开头，指向角色文件夹内的对应文件。

**一个最简化的 `config.json` 示例 (你需要替换所有占位符、示例路径和角色名！)：**
（注：以下参数名是程序内固定的，请勿修改它们。）
```json
{
  "DATA_DIR": ".",
  "CHATBOT": {
    "DEFAULT_IMAGE": "Characters/Kana/images/default.png",
    "DEFAULT_BG_IMAGE": "Characters/Kana/images/background.jpg",
    "INIT_CONFIG": {
      "base_url": "YOUR_API_BASE_URL_HERE",
      "api_key": "YOUR_API_KEY_HERE",
      "model_name": "YOUR_CHOSEN_MODEL_NAME_HERE",
      "temperature": 0.7,
      "memory_db_path": "{DATA_DIR}/kana.db",
      "role_graph_path": "{DATA_DIR}/kana.json",
      "role_name": "佳奈",
      "user_name": "Babel",
      "max_context_length": 15,
      "initial_role_description": "你现在扮演铃木佳奈。佳奈的性格特点是元气、乐观，开朗。",
      "entity_attr": {"性格": ["乐观", "开朗"], "外貌": ["金发", "品乳"]},
      "query_schema": {},
      "answer_schema": {}
    },
    "ROLE_CONFIG": {
        "base_description": "学妹",
        "role_name_in_desc": "佳奈"
    },
    "CHAT_CONFIG": {
        "summarizing_prompt": "请用第一人称（铃木佳奈的口吻）简要总结一下我们刚才的对话要点。",
        "stm_max_fetch_count": 3,
        "ltm_max_fetch_count": 5
    }
  },
  "ROLE_GRAPH": {
    "DATA_PATH": "{DATA_DIR}/kana_graph_data.json"
  },
  "STANDARD_QUERY": {
    "GRAPH_PATH": "{DATA_DIR}/kana_graph_data.json",
    "OUTPUT_DIR": "{DATA_DIR}/queries_kana"
  },
  "STANDARD_ANSWER": {
    "GRAPH_PATH": "{DATA_DIR}/kana_graph_data.json",
    "OUTPUT_DIR": "{DATA_DIR}/qna_data_kana"
  },
  "MEMORY_EDITOR": {
    "DB_PATH": "{DATA_DIR}"
  }
}
```

**请务必仔细检查 `config.json` 中所有的路径、名称和API凭证，确保它们与你的实际文件结构、`feature_function.py` 中的设定以及你的AI服务商账户信息完全一致！一个小小的拼写错误都可能导致角色加载失败。**

---

## 3. 运行你的自定义角色

当你完成了 `feature_function.py` 和 `config.json` 这两个文件的编写和配置后：

1.  打开你电脑的“**命令提示符**”或“**PowerShell**”。
    * 在 Windows 系统中，你可以在开始菜单的搜索框里输入 `cmd` 或 `powershell`，然后回车来打开它。
2.  在打开的黑色命令行窗口中，你需要通过 `cd` 命令（change directory，切换目录）进入到 CialloChat 项目的 **根目录** (也就是 `CialloChat.exe` 文件所在的那个总文件夹)。
    * 例如，如果你的 CialloChat 项目在 `D:\CialloChat_Project`，那么你需要输入：`D:` (回车)，然后输入 `cd CialloChat_Project` (回车)。
    * 一个快速找到路径的方法是：在文件资源管理器中打开CialloChat的根目录，然后复制地址栏中的路径。在命令行窗口中输入 `cd ` (注意cd后面有个空格)，然后右键粘贴路径，再回车。
3.  成功进入项目根目录后，输入以下命令并回车，来启动并加载你的自定义角色：

    ```bash
    CialloChat.exe --character-dir "Characters\Ayane"
    ```
    或者，如果你的角色文件夹路径比较特殊，或者为了保险起见，可以使用绝对路径：
    ```bash
    CialloChat.exe --character-dir "C:\你的CialloChat项目完整路径\CialloChat\Characters\Ayane"
    ```
    **请注意：**
    * 将命令中的 `"Characters\Ayane"` 或者 `"C:\你的CialloChat项目完整路径\CialloChat\Characters\"` 替换成你 **实际创建的角色专属文件夹** 的路径（相对于项目根目录的路径，或者完整的绝对路径）。
    * **如果路径中包含空格，那么整个路径字符串必须用英文双引号 `"` 包裹起来！**

如果一切配置正确，程序应该会开始加载你的自定义角色，并在命令行窗口中打印一些日志信息。随后，它会自动打开浏览器，你就可以开始和你亲手创造的 AI 角色聊天了！

---

自定义角色是一个充满创造力和挑战的过程。遇到问题时，请不要灰心，仔细检查代码中的注释、示例，以及命令行窗口中是否有错误提示。多尝试，多调试，你一定能成功！祝你好运！