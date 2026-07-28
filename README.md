# AI Photo Editor / 电商 AI 工具台

这是一个在自己电脑上运行的 AI 图片工具。

程序打开后运行在：

```text
http://localhost:3000
```

每位用户需要在页面右上角填写自己的 Gemini API Key。

## 第一次下载到电脑

### 第一步：安装 Git

下载安装 Git for Windows：

https://git-scm.com/download/win

安装时保持默认选项即可。

### 第二步：安装 Node.js

电脑还必须安装 Node.js。如果已经安装，可以跳过这一步。

下载地址：

https://nodejs.org/

安装时保持默认选项即可。

### 第三步：把程序克隆到电脑

下载位置可以自己选择。

1. 打开 PowerShell。
2. 例如要把程序下载到 `D:\`，在 PowerShell 中依次运行：

```powershell
cd D:\
git clone https://github.com/AidenArgents/ai-photo-editor.git
```

程序会自动下载到 `D:\ai-photo-editor` 文件夹。

如果这是 Private 私有仓库，需要先登录获得权限的 GitHub 账号。

## 第一次安装和启动

打开刚刚克隆得到的 `ai-photo-editor` 文件夹。

### 第一步：安装程序依赖

双击运行：

```text
install.bat
```

等待窗口显示安装完成。

### 第二步：启动程序

双击运行：

```text
start.bat
```

程序会在后台启动，并自动打开浏览器。

### 第三步：填写 API Key

在页面右上角填写自己的 Gemini API Key，即可开始使用。

API Key 只保存在当前电脑的浏览器中，不会随项目上传。

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

如果程序是通过 GitHub 的 Download ZIP 下载的，`update.bat` 不能自动更新，需要重新下载新版 ZIP。

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

### 修改 API Key

直接在页面右上角重新填写即可。

## 文件说明

| 文件 | 用途 |
|---|---|
| `install.bat` | 第一次安装或修复依赖 |
| `start.bat` | 启动程序 |
| `stop.bat` | 关闭程序 |
| `restart.bat` | 重启程序 |
| `update.bat` | 更新到最新版本 |

普通用户不需要输入命令，也不需要修改项目代码。
