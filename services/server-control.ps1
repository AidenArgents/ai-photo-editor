param(
    [Parameter(Position = 0)]
    [ValidateSet("start", "stop", "restart", "status")]
    [string]$Action = "status"
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$pidFile = Join-Path $projectRoot ".ai-photo-editor.pid"
$logFile = Join-Path $projectRoot "server.log"
$port = 3000

function ConvertTo-HttpProxyUrl {
    param([string]$Value)
    if ([string]::IsNullOrWhiteSpace($Value)) {
        return $null
    }
    $cleanValue = $Value.Trim()
    if ($cleanValue -match "^(?i:https?)://") {
        return $cleanValue
    }
    if ($cleanValue -match "^(?i:socks)") {
        return $null
    }
    return "http://$cleanValue"
}

function Add-LocalhostToNoProxy {
    $requiredEntries = @("localhost", "127.0.0.1", "::1")
    $entries = @()
    if (-not [string]::IsNullOrWhiteSpace($env:NO_PROXY)) {
        $entries = @($env:NO_PROXY.Split(",") | ForEach-Object { $_.Trim() } | Where-Object { $_ })
    }
    foreach ($requiredEntry in $requiredEntries) {
        if ($entries -notcontains $requiredEntry) {
            $entries += $requiredEntry
        }
    }
    $env:NO_PROXY = $entries -join ","
}

function Set-NodeNetworkEnvironment {
    $env:NODE_USE_SYSTEM_CA = "1"

    if ([string]::IsNullOrWhiteSpace($env:HTTPS_PROXY)) {
        if (-not [string]::IsNullOrWhiteSpace($env:HTTP_PROXY)) {
            $env:HTTPS_PROXY = $env:HTTP_PROXY
        }
        elseif (-not [string]::IsNullOrWhiteSpace($env:ALL_PROXY)) {
            $allProxy = ConvertTo-HttpProxyUrl $env:ALL_PROXY
            if ($allProxy) {
                $env:HTTP_PROXY = $allProxy
                $env:HTTPS_PROXY = $allProxy
            }
        }
    }

    if ([string]::IsNullOrWhiteSpace($env:HTTPS_PROXY)) {
        try {
            $settings = Get-ItemProperty `
                -LiteralPath "HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings" `
                -ErrorAction Stop
            if ([int]$settings.ProxyEnable -eq 1 -and
                -not [string]::IsNullOrWhiteSpace([string]$settings.ProxyServer)) {
                $proxyText = ([string]$settings.ProxyServer).Trim()
                $httpProxy = $null
                $httpsProxy = $null

                if ($proxyText -match "=") {
                    foreach ($entry in $proxyText.Split(";")) {
                        $pair = $entry.Split("=", 2)
                        if ($pair.Count -ne 2) {
                            continue
                        }
                        $scheme = $pair[0].Trim().ToLowerInvariant()
                        $proxyUrl = ConvertTo-HttpProxyUrl $pair[1]
                        if ($scheme -eq "http") {
                            $httpProxy = $proxyUrl
                        }
                        elseif ($scheme -eq "https") {
                            $httpsProxy = $proxyUrl
                        }
                    }
                }
                else {
                    $httpProxy = ConvertTo-HttpProxyUrl $proxyText
                    $httpsProxy = $httpProxy
                }

                if (-not $httpsProxy) {
                    $httpsProxy = $httpProxy
                }
                if (-not $httpProxy) {
                    $httpProxy = $httpsProxy
                }
                if ($httpsProxy) {
                    $env:HTTP_PROXY = $httpProxy
                    $env:HTTPS_PROXY = $httpsProxy
                }
            }
        }
        catch {
            # Direct networking remains available when Windows proxy settings cannot be read.
        }
    }

    if (-not [string]::IsNullOrWhiteSpace($env:HTTPS_PROXY)) {
        $env:NODE_USE_ENV_PROXY = "1"
        Add-LocalhostToNoProxy
        $proxyHost = ([Uri]$env:HTTPS_PROXY).Authority
        Write-Host "[INFO] Gemini network requests will use proxy: $proxyHost"
    }
    else {
        Write-Host "[INFO] No HTTP system proxy is enabled. Gemini will use a direct connection."
    }
}

function Remove-StalePidFile {
    if (Test-Path -LiteralPath $pidFile) {
        Remove-Item -LiteralPath $pidFile -Force
    }
}

function Get-ManagedProcess {
    if (-not (Test-Path -LiteralPath $pidFile)) {
        return $null
    }

    $rawPid = (Get-Content -LiteralPath $pidFile -Raw).Trim()
    $managedPid = 0
    if (-not [int]::TryParse($rawPid, [ref]$managedPid)) {
        Write-Warning "Invalid project PID file. Removing it."
        Remove-StalePidFile
        return $null
    }

    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $managedPid" -ErrorAction SilentlyContinue
    if (-not $process) {
        Remove-StalePidFile
        return $null
    }

    $isExpectedRunner = (
        $process.Name -ieq "cmd.exe" -and
        $process.CommandLine -match "npm(?:\.cmd)?\s+run\s+dev"
    )
    if (-not $isExpectedRunner) {
        Write-Warning "PID $managedPid no longer belongs to AI Photo Editor. It will not be stopped."
        Remove-StalePidFile
        return $null
    }

    return $process
}

function Get-PortOwner {
    return Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue |
        Select-Object -First 1
}

function Start-ProjectServer {
    $managedProcess = Get-ManagedProcess
    if ($managedProcess) {
        Write-Host "[OK] AI Photo Editor is already running (manager PID $($managedProcess.ProcessId))."
        return
    }

    $portOwner = Get-PortOwner
    if ($portOwner) {
        throw "Port $port is already occupied by PID $($portOwner.OwningProcess). The process was not stopped."
    }

    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        throw "Node.js is not installed or is not available in PATH."
    }
    if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
        throw "npm is not available in PATH."
    }
    if (-not (Test-Path -LiteralPath (Join-Path $projectRoot "node_modules"))) {
        throw "Project dependencies are missing. Run 安装.bat first."
    }

    Set-NodeNetworkEnvironment

    $escapedLogFile = $logFile.Replace('"', '""')
    $command = "npm.cmd run dev >> `"$escapedLogFile`" 2>&1"
    $runner = Start-Process `
        -FilePath $env:ComSpec `
        -ArgumentList @("/d", "/s", "/c", $command) `
        -WorkingDirectory $projectRoot `
        -WindowStyle Hidden `
        -PassThru

    Set-Content -LiteralPath $pidFile -Value $runner.Id -Encoding ascii

    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        Start-Sleep -Milliseconds 500
        if (Get-PortOwner) {
            Write-Host "[OK] AI Photo Editor is listening on http://localhost:$port"
            return
        }
        if ($runner.HasExited) {
            Remove-StalePidFile
            throw "The server process exited during startup. Check server.log for details."
        }
    }

    & taskkill.exe /PID $runner.Id /T /F *> $null
    Remove-StalePidFile
    throw "The server did not listen on port $port within 15 seconds. Check server.log for details."
}

function Stop-ProjectServer {
    $managedProcess = Get-ManagedProcess
    if (-not $managedProcess) {
        $portOwner = Get-PortOwner
        if ($portOwner) {
            throw "Port $port is in use by unmanaged PID $($portOwner.OwningProcess). It was not stopped."
        }
        Write-Host "[OK] AI Photo Editor is not running."
        return
    }

    $managedPid = $managedProcess.ProcessId
    & taskkill.exe /PID $managedPid /T /F *> $null
    Remove-StalePidFile

    for ($attempt = 0; $attempt -lt 20; $attempt++) {
        if (-not (Get-PortOwner)) {
            Write-Host "[OK] AI Photo Editor has been stopped."
            return
        }
        Start-Sleep -Milliseconds 250
    }

    throw "The managed process was stopped, but port $port is still occupied."
}

function Show-ProjectStatus {
    $managedProcess = Get-ManagedProcess
    $portOwner = Get-PortOwner

    if ($managedProcess -and $portOwner) {
        Write-Host "[RUNNING] manager PID $($managedProcess.ProcessId), port owner PID $($portOwner.OwningProcess)"
        return
    }
    if ($portOwner) {
        Write-Host "[UNMANAGED] port $port is occupied by PID $($portOwner.OwningProcess)"
        return
    }
    Write-Host "[STOPPED] AI Photo Editor is not running."
}

try {
    switch ($Action) {
        "start" {
            Start-ProjectServer
        }
        "stop" {
            Stop-ProjectServer
        }
        "restart" {
            Stop-ProjectServer
            Start-Sleep -Milliseconds 500
            Start-ProjectServer
        }
        "status" {
            Show-ProjectStatus
        }
    }
}
catch {
    Write-Host "[ERROR] $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
