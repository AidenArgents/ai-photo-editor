@echo off
chcp 936 > nul
title AI Photo Editor - 一键启动脚本

echo ===================================================
echo           AI Photo Editor - 一键启动
echo ===================================================
echo.

rem 1. 检查 Node.js 环境
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo 【错误】未检测到 Node.js！
    echo 请先前往 https://nodejs.org/ 下载并安装 Node.js [推荐 LTS 版本]。
    echo 安装完成后，重新双击此脚本即可。
    echo.
    pause
    exit /b 1
)

rem 2. 检查依赖项 node_modules
if not exist "node_modules\" (
    echo [1/3] 正在安装项目依赖，首次运行可能需要 1-2 分钟，请稍候...
    call npm install
    if %errorlevel% neq 0 (
        echo 【错误】依赖安装失败，请检查网络连接或 NPM 配置。
        pause
        exit /b 1
    )
    echo [OK] 依赖安装完成！
) else (
    echo [1/3] 项目依赖已存在，跳过安装。
)

rem 3. 检查 .env 配置文件
if not exist ".env" (
    if exist ".env.example" (
        copy .env.example .env >nul
    ) else (
        echo GEMINI_API_KEY=> .env
    )
    echo [2/3] 已初始化 .env 配置文件。
    echo [注意：您可以在网页右上角直接输入 Gemini API Key，或在 .env 文件中填入 GEMINI_API_KEY]
) else (
    echo [2/3] 配置文件 .env 已就绪。
)

rem 4. 启动服务并自动打开浏览器
echo [3/3] 正在启动服务...
echo 项目网址: http://localhost:3000
echo.

rem 延时 3 秒后自动打开浏览器
start "" cmd /c "timeout /t 3 >nul && start http://localhost:3000"

rem 启动 Node 开发服务器
call npm run dev

pause
