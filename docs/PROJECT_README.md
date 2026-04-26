# AI-StudyCompanion v0.3 项目介绍与技术文档

## 1. 项目简介

AI-StudyCompanion（代号 KnowFlow）是一个以科目为核心的多模态智能学习辅助系统。用户上传学习资料（PDF、图片、音频、视频、文档等），系统自动解析抽取知识点，构建知识图谱和知识组，并支持智能对话问答、自动习题生成与批改、个性化复习计划制定等功能。

**技术栈**：后端 Python FastAPI + SQLAlchemy，前端 React 18 + TypeScript + Vite，使用 Docker Compose 一站式编排运行。

---

## 2. 系统架构

```
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│  浏览器/Nginx │────▶│  FastAPI      │────▶│  PostgreSQL   │
│  (React SPA)  │     │  (Uvicorn)    │     │  (pgvector)   │
└───────────────┘     └───────┬───────┘     └───────────────┘
                              │                     │
                              │                     │
                        ┌─────▼───────┐     ┌───────▼────────┐
                        │  Celery     │     │  Redis         │
                        │  (后台任务)  │     │  (缓存/队列)   │
                        └─────────────┘     └────────────────┘
                                                   │
                                             ┌─────▼──────┐
                                             │  MinIO     │
                                             │  (文件存储) │
                                             └────────────┘
                                             ┌──────────────┐
                                             │  Qdrant      │
                                             │  (向量数据库) │
                                             └──────────────┘
```

### 2.1 核心组件

| 组件 | 技术 | 用途 |
|------|------|------|
| **前端** | React 18 + TypeScript + Vite | SPA 用户界面，由 Nginx 服务 |
| **后端** | Python 3.11 + FastAPI + Uvicorn | RESTful API 服务 |
| **数据库** | PostgreSQL 16 + pgvector | 业务数据 + 向量存储 |
| **文件存储** | MinIO | 学习资料文件的对象存储 |
| **向量检索** | Qdrant | 语义向量检索（RAG 对话） |
| **缓存/队列** | Redis 7 | Celery 消息队列 + 缓存 |
| **任务队列** | Celery | 异步后台任务（文件解析等） |

### 2.2 项目目录结构

```
KnowFlow/
├── docker-compose.yml          # Docker 编排配置文件
├── .env / .env.example         # 环境变量
├── .gitignore
│
├── backend/                    # Python 后端
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py             # FastAPI 入口
│       ├── config.py           # 配置管理
│       ├── database.py         # 数据库连接
│       ├── migration.py        # 数据库迁移
│       ├── celery_app.py       # Celery 任务应用
│       │
│       ├── api/                # API 路由层
│       │   ├── subjects.py     # 科目 CRUD
│       │   ├── resources.py    # 资料上传/删除
│       │   ├── chat.py         # 对话 + 消息历史
│       │   ├── knowledge.py    # 知识点 CRUD + 搜索 + 详情
│       │   ├── knowledge_groups.py  # 知识组管理 + 自动分组/归并
│       │   ├── quiz.py         # 习题生成 + 批改
│       │   ├── review.py       # 复习计划/指南
│       │   ├── exercises.py    # 习题库管理
│       │   ├── conversations.py    # 对话记录管理
│       │   └── model_config.py # 模型配置
│       │
│       ├── models/             # SQLAlchemy ORM 模型
│       │   ├── subject.py
│       │   ├── resource.py
│       │   ├── chunk.py
│       │   ├── knowledge_point.py
│       │   ├── knowledge_group.py
│       │   ├── bkt_state.py
│       │   ├── chat_message.py
│       │   ├── conversation.py
│       │   ├── quiz.py
│       │   ├── subject_exercise.py
│       │   └── model_config.py
│       │
│       ├── schemas/            # Pydantic 数据模型
│       │   ├── subject.py, resource.py, chat.py, knowledge.py,
│       │   ├── knowledge_group.py, quiz.py, review.py,
│       │     exercise.py, model_config.py
│       │
│       ├── services/           # 业务逻辑层
│       │   ├── model_adapter.py    # LLM 模型适配器（多供应商）
│       │   ├── rag_engine.py       # RAG 对话引擎
│       │   ├── knowledge_graph.py  # 知识图谱/抽取/归并/自动组织
│       │   ├── document_parser.py  # 文档解析（切片+知识抽取）
│       │   ├── bkt_engine.py       # BKT 贝叶斯知识追踪
│       │   ├── quiz_engine.py      # 习题生成 + 批改
│       │   └── review_scheduler.py # 复习计划调度
│       │
│       └── core/
│           ├── deps.py             # 依赖注入
│           └── model_config_manager.py  # 模型配置管理器
│
└── frontend/                   # React 前端
    ├── Dockerfile
    ├── .dockerignore           # 避免 node_modules 覆盖
    ├── nginx.conf              # Nginx 配置
    ├── package.json
    ├── vite.config.ts
    ├── index.html
    └── src/
        ├── main.tsx            # 应用入口
        ├── App.tsx             # 路由 + 模型配置守卫
        ├── styles.ts           # 统一设计 Token（颜色/圆角/阴影）
        │
        ├── api/
        │   ├── client.ts       # Axios HTTP 客户端
        │   └── subjects.ts     # 所有 API 接口定义
        │
        ├── components/
        │   ├── Layout.tsx      # 主布局（左侧导航）
        │   ├── SubjectNav.tsx  # 科目内部导航栏（hover 动效）
        │   ├── Toast.tsx       # 全局 Toast 通知
        │   ├── Button.tsx      # 通用按钮（4 变体 × 3 尺寸）
        │   ├── Card.tsx        # 通用卡片（hoverable 提升）
        │   ├── Input.tsx       # 通用输入框（focus 光环）
        │   ├── Modal.tsx       # 通用弹窗（fade+scale 动画）
        │   ├── Badge.tsx       # 状态标签（5 变体）
        │   ├── FileDropzone.tsx    # 拖拽上传组件
        │   └── MarkdownMessage.tsx # Markdown 渲染 + MD/TXT 复制
        │
        └── pages/
            ├── SubjectList.tsx       # 科目列表页
            ├── SubjectLayout.tsx     # 科目子页面公共容器
            ├── SubjectDetail.tsx     # 科目概览/拖拽上传/统计
            ├── Chat.tsx              # 对话（Markdown 渲染）
            ├── KnowledgeGraph.tsx    # 知识结构/自动整理
            ├── Quiz.tsx              # 习题生成/答题/批改
            ├── Review.tsx            # 复习计划
            └── ModelConfig.tsx       # 模型配置页
```

---

## 3. 核心技术功能

### 3.1 文档解析与知识抽取

**流程**：`上传文件 → 存储到 MinIO → 语义切片 → LLM 抽取三元组 → 去重归并 → 自动创建知识组 → 生成描述`

- 支持类型：PDF、图片（OCR）、音频（ASR）、视频、DOCX、TXT
- 切片策略：按语义段落分割（`###`/`##` 标题、空行、换行符）
- 三元组抽取：调用 LLM 提取 `(实体, 关系, 目标实体, 描述)` 结构
- **v0.3 优化**：抽象粒度提示词改进（提取"章节/主题级"概念），详细内容放入 `description` 字段

### 3.2 知识点管理系统

- **知识组（KnowledgeGroup）**：文件夹式分类，支持重命名、删除
- **知识点标记（v0.2）**：⭐重点 / 🔥难点（可点击切换），树和列表中以图标显示
- **搜索**：按名称模糊搜索
- **批量操作**：多选、批量删除（**v0.3 改为 Modal 确认弹窗**）
- **编辑**：修改名称和描述
- **自动整理（v0.3）**：一键调用 LLM 归并重复知识点 + 创建知识组 + 删除空组
- **关联查看**：点击知识点查看来源资料片段 + 关联习题详情弹窗

### 3.3 智能对话（RAG）

- 检索增强生成：Qdrant 语义检索 → 相关切片 → LLM 回答
- **Markdown 渲染（v0.3）**：AI 答案以 Markdown 格式渲染（标题/代码/表格/列表），附带「复制 MD」「复制 TXT」按钮
- 对话持久化：按 `conversation` 隔离，历史自动保存/加载
- 对话记录管理：新建、切换、重命名、删除对话

### 3.4 习题系统

**生成**：
- 数量选择 1~10 题，难度选择（简单/中等/困难）
- 题型：单选题 / 多选题 / 填空题 / 主观题
- **v0.3 UI 优化**：横向排列的配置栏 + 独立的提示词 textarea + 题型标签美化 + 生成按钮靠右
- 渐进式生成：每次调用 LLM 生成 1~2 题，逐轮累加，避免重复

**批改**：
- 单选题/多选题：后端精确/集合比对
- 填空题：精确匹配
- 主观题：LLM 批改（评分 + 评语 + 修正答案）

### 3.5 复习计划

- 基于 BKT（贝叶斯知识追踪）模型的掌握度计算
- 遗忘曲线衰减 + 紧迫度评分
- 复习指南：LLM 根据弱知识点生成个性化讲解

### 3.6 前端美化体系（v0.3）

**设计 Token**：统一 `styles.ts` 定义颜色/圆角/阴影/过渡曲线

| 组件 | 功能 |
|------|------|
| `Button` | 4 种变体（primary/secondary/danger/ghost），3 种尺寸，hover 动效 |
| `Card` | hoverable 模式阴影提升 + 上移 |
| `Input` | focus 蓝色外发光环，支持多行 |
| `Modal` | fadeIn + scaleIn 动画入场，遮罩点击关闭 |
| `Badge` | 5 种变体状态标签 |
| `FileDropzone` | 拖拽 + 点击选择，dragover 高亮，文件预览 |
| `MarkdownMessage` | Markdown 渲染 + `stripMarkdown` 转纯文本 + MD/TXT 双按钮复制 |

**页面级改进**：
- 全局 hover 微交互 + smooth 过渡
- SubjecNav tab 动效 + 返回按钮美化
- 科目卡片 hover 阴影提升
- 对话气泡二次贝塞尔圆角 + 最后消息入场动画
- 习题选项 hover 浅灰背景
- 概览统计卡片 hover 上移
- 模型配置所有输入框 focus 光环

### 3.7 LLM 模型适配器

支持多供应商切换，统一接口：

| 供应商 | 适配器类 | 备注 |
|--------|---------|------|
| OpenAI | `OpenaiProvider` | 原生 API |
| Anthropic | `AnthropicProvider` | Claude 系列 |
| Google | `GoogleProvider` | Gemini 系列 |
| 百度 | `BaiduProvider` | 文心系列 |
| 智谱 | `ZhipuaiProvider` | GLM 系列 |
| 阿里云 | `OpenaiCompatibleProvider` | 通义千问 |
| DeepSeek | `OpenaiCompatibleProvider` | |
| 腾讯混元 | `OpenaiCompatibleProvider` | |
| SiliconFlow | `OpenaiCompatibleProvider` | |
| Moonshot | `OpenaiCompatibleProvider` | |

---

## 4. 数据库模型关系

```
Subject (1) ──── (N) Resource ──── (N) Chunk
Subject (1) ──── (N) KnowledgePoint
Subject (1) ──── (N) KnowledgeGroup
KnowledgeGroup (1) ──── (N) KnowledgePoint
KnowledgePoint (1) ──── (N) KpResourceBinding ──── (1) Chunk
KnowledgePoint (1) ──── (N) KnowledgePointRelation (自引用)
Subject (1) ──── (N) SubjectExercise ──── (N) KnowledgePoint (多对多)
Subject (1) ──── (N) Conversation ──── (N) ChatMessage
KnowledgePoint (1) ──── (1) BKTState
```

---

## 5. API 路由一览

| 前缀 | 标签 | 主要端点 |
|------|------|---------|
| `/api/subjects` | 科目 | `GET/POST/PUT/DELETE` |
| `/api/resources` | 资料 | `POST /upload`, `GET /subject/{id}`, `DELETE /{id}` |
| `/api/chat` | 对话 | `POST` (发送), `GET /history/{subject_id}` |
| `/api/conversations` | 对话记录 | `GET/POST /subject/{id}`, `PUT/DELETE /{id}` |
| `/api/knowledge` | 知识点 | `GET /list/{id}`, `GET /detail/{kp_id}`, `GET /search/{id}`, `PUT/DELETE point/{kp_id}`, `POST /batch-delete` |
| `/api/groups` | 知识组 | `GET/POST /subject/{id}`, `PUT/DELETE /{group_id}`, `GET /tree/{id}`, `POST /auto-group/{id}` (含归并去重+删除空组) |
| `/api/quiz` | 习题 | `POST /generate-batch`, `POST /grade` |
| `/api/exercises` | 习题库 | `GET /subject/{id}`, `DELETE /{id}` |
| `/api/review` | 复习 | `GET /plan/{id}`, `GET /guide/{id}` |
| `/api/model-config` | 模型配置 | `GET /providers`, `GET`, `POST` |
| `/api/health` | - | `GET` 健康检查 |

---

## 6. 关键技术细节

### 6.1 BKT（Bayesian Knowledge Tracing）算法

```python
p_correct = p_learn * (1 - p_slip) + (1 - p_learn) * p_guess
# 正确时: p_updated = (p_learn * (1 - p_slip)) / p_correct
# 错误时: p_updated = (p_learn * p_slip) / (1 - p_correct)
p_learn = p_updated + (1 - p_updated) * p_transit

# 遗忘曲线
decay = exp(-hours_since / tau)
p_learn = p_learn * decay
```

参数：`p_transit=0.1`（学习率）、`p_guess=0.15`（猜测概率）、`p_slip=0.1`（疏忽概率）、`tau=72`（遗忘半衰期小时）

### 6.2 RAG 对话引擎

- Qdrant 向量检索：`collection_name = subject.id`
- 检索策略：query → embedding → top_k=5 相关切片
- 上下文构建：检索切片 + 对话历史 + 当前问题 → LLM

### 6.3 习题生成渐进式算法

```
count = 用户选择 (1-10)
while len(generated) < count:
    per_call = 2 if count >= 3 else 1
    batch = LLM.generate(per_call 道, 避免已生成题)
    for item in batch:
        保存到 subject_exercises
        关联知识点 (exercise_kp_links)
```

---

## 7. 版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| **v0.3** | 2026-04 | **前端美化**：6 个通用组件（Button/Card/Input/Modal/Badge/FileDropzone）+ 拖拽上传 + Markdown 渲染（react-markdown）+ MD/TXT 复制 + 习题 UI 优化 + 知识点提取提示词优化 + 自动整理按钮（归并去重+删空组）+ Modal 确认删除 + 切页无闪烁（SubjectLayout）+ 构建修复（.dockerignore/tsc权限） |
| v0.2 | 2026-04 | 对话管理、习题系统重写、复习加载优化、知识标记、首页按钮、模型配置守卫、冗余清理、Qdrant 启动优化、导航修复、仪表盘删除、模型 ID 自定义、多模态警告 |
| v0.1 | 2026-04 | 初始版本 |

---

## 8. 许可证

该项目仅供个人学习与研究使用。
