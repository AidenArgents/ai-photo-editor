# AI Photo Editor / 电商 AI 工具台

这是一个在自己电脑上运行的 AI 图片工具。

程序打开后运行在：

```text
http://localhost:3000
```

每位用户需要在页面右上角填写自己的 Gemini API Key。

## 第一次使用（推荐）

不需要提前安装 Git、Node.js，也不需要输入命令。

1. 打开项目页面：

   https://github.com/AidenArgents/ai-photo-editor

2. 点击绿色的 `Code`，再点击 `Download ZIP`。
3. 把 ZIP 解压到想存放程序的位置。
4. 打开解压后的文件夹，双击：

```text
setup.bat
```

安装程序会自动：

- 检查电脑环境；
- 缺少 Git 或 Node.js 时，下载项目专用的便携版本；
- 准备以后需要的一键更新功能；
- 安装项目依赖；
- 启动程序并打开浏览器。

便携运行环境只保存在项目自己的 `.runtime` 文件夹，不会安装到 Windows 系统。

安装过程中需要保持网络连接。第一次安装下载内容较多，请等待窗口显示完成。

### 填写 API Key

在页面右上角填写自己的 Gemini API Key，即可开始使用。

API Key 只保存在当前电脑的浏览器中，不会随项目上传。

## `setup.bat` 和 `install.bat` 的区别

### `setup.bat`：第一次使用

第一次把程序下载到电脑后，优先双击 `setup.bat`。

它负责完整的首次准备工作：

- 检查 Git 和 Node.js；
- 缺少时下载项目专用的便携版本；
- 让 Download ZIP 得到的文件夹也能使用 `update.bat`；
- 安装项目依赖；
- 启动程序并打开浏览器。

### `install.bat`：安装或修复依赖

`install.bat` 用于项目文件夹已经准备好的情况。

它会：

- 检查并准备 Git 和 Node.js；
- 安装或修复 `node_modules` 项目依赖。

它不会重新下载项目，也不会启动程序。运行完成后，需要再双击 `start.bat`。

通常情况下：

- 第一次使用：运行 `setup.bat`；
- 依赖损坏或安装不完整：运行 `install.bat`；
- 平时打开程序：运行 `start.bat`。

## 手动安装 Git 和 Node.js（可选）

普通用户不需要手动安装。`setup.bat` 和 `install.bat` 会在项目内部准备便携版本。

如果希望 Git 和 Node.js 也能供电脑上的其他程序使用，可以提前手动安装系统版本。

### 安装 Git for Windows

下载地址：

https://git-scm.com/download/win

安装时保持默认选项即可。

### 安装 Node.js

建议安装 LTS 长期支持版：

https://nodejs.org/

安装时保持默认选项即可。

安装完成后重新打开项目文件夹，再运行 `setup.bat`。程序检测到系统已经安装 Git 和 Node.js 后，会直接复用，不再下载便携版本。

## 使用 Git 克隆（可选）

电脑已经安装 Git 时，也可以使用克隆方式。

例如要下载到 `D:\`，打开 PowerShell 后运行：

```powershell
cd D:\
git clone https://github.com/AidenArgents/ai-photo-editor.git
```

然后打开 `D:\ai-photo-editor`，双击 `setup.bat`。

## 平时使用

### 启动程序

双击：

```text
start.bat
```

### 关闭程序

双击：

```text
stop.bat
```

### 重启程序

双击：

```text
restart.bat
```

### 更新程序

双击：

```text
update.bat
```

更新工具会自动下载新版本、安装需要的依赖并重新启动程序。

## 出现问题时

### 依赖损坏或安装不完整

重新双击：

```text
install.bat
```

安装完成后再运行：

```text
start.bat
```

### 页面没有自动打开

先确认已经运行 `start.bat`，然后在浏览器中打开：

```text
http://localhost:3000
```

### 显示 `fetch failed` 或无法连接 Gemini

这表示页面和本地服务已经启动，但这台电脑无法连接 Google 的 Gemini API。

如果使用代理软件：

1. 开启代理软件的“系统代理”或“TUN/虚拟网卡模式”；
2. 仅安装在浏览器里的代理扩展不能供本地服务使用；
3. 双击 `restart.bat`，让程序重新读取代理设置；
4. 再次生成图片。

程序启动时会自动读取 Windows 系统代理。详细的底层网络错误保存在项目文件夹的 `server.log` 中。

### 修改 API Key

直接在页面右上角重新填写即可。

## 文件说明

| 文件 | 用途 |
|---|---|
| `setup.bat` | 第一次自动安装并启动 |
| `install.bat` | 自动准备运行环境或修复依赖 |
| `start.bat` | 启动程序 |
| `stop.bat` | 关闭程序 |
| `restart.bat` | 重启程序 |
| `update.bat` | 更新到最新版本 |

普通用户不需要输入命令，也不需要修改项目代码。
