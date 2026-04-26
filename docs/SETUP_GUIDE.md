# AI-StudyCompanion v0.3 部署与启动指南

## 1. 环境要求

| 组件             | 最低版本                    | 说明    |
| -------------- | ----------------------- | ----- |
| Docker         | 24.0+                   | 容器运行时 |
| Docker Compose | 2.20+                   | 多容器编排 |
| Git            | 2.30+                   | 版本管理  |
| 操作系统           | Windows / macOS / Linux | 不限    |

> 无需安装 Python、Node.js、PostgreSQL 等，全部由 Docker 容器化运行。

***

## 2. Windows Docker Desktop 安装与配置（推荐）

### 2.1 安装 Docker Desktop

1. **下载**：访问 [https://www.docker.com/products/docker-desktop/](https://www.docker.com/products/docker-desktop/) 下载 Docker Desktop for Windows
2. **安装**：双击安装包，一路默认安装，安装完成后重启电脑
3. **启动**：桌面双击 Docker Desktop 图标，等待引擎启动（右下角鲸鱼图标停止转圈）
4. **验证**：打开 CMD 或 PowerShell，运行：

```powershell
docker --version
docker compose version
```

> 注意：Windows 系统请始终使用 `docker compose`（空格）命令，不要使用 `docker-compose`（连字符）。

### 2.2 配置国内镜像加速（重要）

由于 Docker Hub 服务器在境外，国内下载可能很慢。强烈建议配置镜像加速器。

打开 Docker Desktop → 点右上角 ⚙️ **Settings** → 左侧选 **Docker Engine**，将配置文件替换为：

```json
{
  "builder": {
    "gc": {
      "defaultKeepStorage": "20GB",
      "enabled": true
    }
  },
  "experimental": false,
  "registry-mirrors": [
    "https://docker.m.daocloud.io",
    "https://huecker.io",
    "https://dockerhub.timeweb.cloud",
    "https://noohub.ru"
  ]
}
```

点击 **Apply & Restart** 按钮，Docker 会自动重启使配置生效。

> Linux / macOS 用户将上述 json 写入 `/etc/docker/daemon.json`，然后执行 `systemctl reload docker`。

***

## 3. 快速启动（推荐）

### 3.1 克隆或解压项目

```bash
git clone <仓库地址> KnowFlow
cd KnowFlow
```

如果已有项目文件夹：

```bash
cd KnowFlow
```

### 3.2 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件，按实际需要修改（如已使用默认值则无需修改）：

```bash
# 数据库
POSTGRES_DB=studycompanion
POSTGRES_USER=studyuser
POSTGRES_PASSWORD=study_pass_2024

# MinIO 对象存储（文件服务器）
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin123
MINIO_BUCKET=study-resources

# Redis
REDIS_PASSWORD=redis_pass_2024

# 应用配置
BACKEND_PORT=8000
FRONTEND_PORT=80
APP_NAME=AI-StudyCompanion
```

> 项目中已提供 `.env` 文件（默认值），如无特殊需求可直接跳过此步。

### 3.3 启动服务

```bash
docker compose up -d
```

首次启动会下载镜像并构建，约需 3\~5 分钟。之后启动只需 10\~30 秒。

### 3.4 验证启动

```bash
docker compose ps
```

预期输出（全部健康）：

```
NAME                STATUS
knowflow-postgres   Up (healthy)
knowflow-minio      Up (healthy)
knowflow-redis      Up (healthy)
knowflow-qdrant     Up
knowflow-backend    Up
knowflow-frontend   Up
knowflow-celery     Up
```

### 3.5 访问系统

| 服务        | 地址                                 | 说明                   |
| --------- | ---------------------------------- | -------------------- |
| 前端页面      | http://localhost                   | 主界面                  |
| 后端 API    | http://localhost:8000              | 直接调用                 |
| MinIO 控制台 | http://localhost:9001              | 文件管理                 |
| API 健康检查  | http://localhost:8000/api/health   | 返回 `{"status":"ok"}` |

***

## 4. 使用流程

### 4.1 首次使用

1. 浏览器打开 `http://localhost`
2. **系统自动检测模型配置**，若未配置则自动跳转到 **模型配置** 页面
3. 配置你的 LLM 模型（如 DeepSeek、硅基流动、OpenAI 等）
4. 保存后自动跳转到科目列表

### 4.2 配置模型（参考值）

| 平台          | Provider    | Model                   | API Key | Base URL |
| ----------- | ----------- | ----------------------- | ------- | -------- |
| DeepSeek    | deepseek    | deepseek-chat           | 你的 Key  | -        |
| SiliconFlow | siliconflow | deepseek-ai/DeepSeek-V3 | 你的 Key  | -        |
| OpenAI      | openai      | gpt-4o-mini             | 你的 Key  | -        |
| 阿里云         | aliyun      | qwen-plus               | 你的 Key  | -        |

### 4.3 核心操作流程

```
1. 创建科目 → 2. 上传资料 → 3. 自动提取知识点 → 4. 对话学习
                                          ↓
                                   5. 生成习题练习
                                          ↓
                                   6. 查看复习计划
```

***

## 5. 常用命令

### 5.1 服务管理

```bash
# 查看所有服务状态
docker compose ps

# 查看日志（实时）
docker compose logs -f backend

# 重启单个服务
docker compose restart backend

# 重建并启动（代码修改后）
docker compose up -d --build backend     # 仅后端
docker compose up -d --build frontend    # 仅前端
docker compose up -d --build             # 全量重建

# 停止所有服务
docker compose down

# 停止并删除数据卷（⚠️ 会清空数据库）
docker compose down -v

# 进入后端容器内部
docker compose exec backend bash
```

### 5.2 查看日志

```bash
# 后端日志
docker compose logs backend --tail 50

# 数据库日志
docker compose logs postgres --tail 20

# 实时日志
docker compose logs -f backend
```

***

## 6. 手动构建（无需 Docker）

如果只想运行后端或前端进行开发调试：

### 6.1 后端

```bash
# 需安装 Python 3.11+
cd backend
python -m venv .venv
.venv\Scripts\activate    # Windows
source .venv/bin/activate # Linux/Mac

pip install -r requirements.txt

# 需自行启动 PostgreSQL、MinIO、Redis、Qdrant 并配置 .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 6.2 前端

```bash
# 需安装 Node.js 18+
cd frontend
npm install
npm run dev
# 访问 http://localhost:5173
```

***

## 7. 数据库迁移

系统启动时自动执行迁移（`migration.py`），无需手动操作。迁移包括：

- 创建 `knowledge_groups` 表
- 创建 `chat_messages` 表
- 创建 `conversations` 表
- 创建 `subject_exercises` + `exercise_kp_links` 表
- 为 `knowledge_points` 添加 `group_id` / `is_important` / `is_difficult` 列
- 为 `chat_messages` 添加 `conversation_id` 列

***

## 8. 常见问题

### 8.1 镜像拉取慢 / 超时

```
failed to fetch oauth token: Post "https://auth.docker.io/token": dial tcp [2a03:...]:443: connectex
```

**原因**：国内网络访问 Docker Hub 不稳定，IPv6 超时。

**修复**：按上方第 2.2 节配置国内镜像加速器，然后重启 Docker Desktop 重试。

### 8.2 Qdrant 启动慢 / 超时

```
Container knowflow-qdrant Waiting (超过 90 秒)
```

**原因**：qdrant 镜像无 `wget`，旧版 healthcheck 始终失败。

**修复**：已在新版本中禁用 healthcheck，将 `depends_on` 改为 `service_started`。

### 8.3 后端 500 / 启动失败

```bash
# 查看具体错误
docker compose logs backend --tail 30
```

常见原因：

- 数据库连接失败（检查 `.env` 中 POSTGRES\_\* 配置）
- 模型未配置（访问 `/model-config` 页面配置）
- 数据库列不匹配（需重建或确认 migration 运行）

### 8.4 前端页面空白

```bash
# 检查前端容器状态
docker compose ps frontend
docker compose logs frontend --tail 20
```

常见原因：

- 前端镜像未重建（代码修改后需 `docker compose up -d --build frontend`）
- Nginx 反向代理配置错误

### 8.5 tsc: Permission denied

```
sh: tsc: Permission denied
```

**原因**：从 Windows 传文件到 Linux 后，`node_modules/.bin/tsc` 可执行权限丢失。

**修复**：项目已默认使用 `vite build`（跳过 tsc 阶段），如仍遇到此问题，执行：

```bash
chmod +x frontend/node_modules/.bin/tsc
```

或删掉本地的 `node_modules` 目录重新构建：

```bash
rm -rf frontend/node_modules
docker compose up -d --build
```

***

## 9. 开发环境建议

### 9.1 VS Code 扩展

- Python
- Pylance
- ESLint
- Prettier

### 9.2 调试后端

```bash
# 以开发模式运行（热重载）
docker compose up -d backend
docker compose logs -f backend
```

后端代码映射到容器内 `/app`，Uvicorn 自动检测文件变化并重载。

### 9.3 调试前端

```bash
cd frontend
npm run dev
# 访问 http://localhost:5173，热更新
```

***

## 10. 技术栈速查

| 层       | 技术                                   |
| ------- | ------------------------------------ |
| 前端框架    | React 18 + TypeScript                |
| 构建工具    | Vite                                 |
| 后端框架    | FastAPI (Python 3.11)                |
| ORM     | SQLAlchemy 2.0 (async)               |
| 数据库     | PostgreSQL 16 + pgvector             |
| 向量存储    | Qdrant                               |
| 对象存储    | MinIO                                |
| 消息队列    | Redis + Celery                       |
| 容器编排    | Docker Compose                       |
| Web 服务器 | Nginx (frontend) + Uvicorn (backend) |
