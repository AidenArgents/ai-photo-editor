param(
    [switch]$EnsureGit,
    [switch]$EnsureNode,
    [string]$RuntimeRoot,
    [switch]$ForcePortable
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

$projectRoot = Split-Path -Parent $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($RuntimeRoot)) {
    $RuntimeRoot = Join-Path $projectRoot ".runtime"
}
$RuntimeRoot = [IO.Path]::GetFullPath($RuntimeRoot)

function Get-WindowsArchitecture {
    $architecture = $env:PROCESSOR_ARCHITEW6432
    if ([string]::IsNullOrWhiteSpace($architecture)) {
        $architecture = $env:PROCESSOR_ARCHITECTURE
    }
    if ($architecture -match "ARM64") {
        return "arm64"
    }
    return "x64"
}

function Invoke-Download {
    param(
        [string]$Uri,
        [string]$Destination
    )
    Write-Host "[INFO] Downloading $Uri"
    Invoke-WebRequest -Uri $Uri -OutFile $Destination -UseBasicParsing
}

function Assert-Sha256 {
    param(
        [string]$Path,
        [string]$ExpectedHash
    )
    if ([string]::IsNullOrWhiteSpace($ExpectedHash)) {
        throw "A SHA-256 checksum was not supplied for $Path."
    }
    $actualHash = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actualHash -ne $ExpectedHash.ToLowerInvariant()) {
        throw "SHA-256 verification failed for $Path."
    }
}

function Test-NodeExecutable {
    param([string]$Executable)
    if (-not (Test-Path -LiteralPath $Executable -PathType Leaf)) {
        return $false
    }
    try {
        $versionText = (& $Executable --version 2>$null).TrimStart("v")
        $version = [Version]$versionText
        return $version -ge [Version]"24.6.0"
    }
    catch {
        return $false
    }
}

function Install-PortableNode {
    $architecture = Get-WindowsArchitecture
    $fileKind = "win-$architecture-zip"
    $releases = Invoke-RestMethod -Uri "https://nodejs.org/dist/index.json" -UseBasicParsing
    $release = $releases |
        Where-Object { $_.lts -and $_.files -contains $fileKind } |
        Select-Object -First 1
    if (-not $release) {
        throw "No compatible Node.js LTS Windows package was found."
    }

    $version = $release.version
    $archiveName = "node-$version-win-$architecture.zip"
    $downloadDirectory = Join-Path $RuntimeRoot "downloads"
    $archivePath = Join-Path $downloadDirectory $archiveName
    $stagingDirectory = Join-Path $RuntimeRoot "node-stage-$PID"
    $nodeDirectory = Join-Path $RuntimeRoot "node"

    New-Item -ItemType Directory -Path $downloadDirectory -Force | Out-Null
    Invoke-Download "https://nodejs.org/dist/$version/$archiveName" $archivePath

    $checksumText = (Invoke-WebRequest -Uri "https://nodejs.org/dist/$version/SHASUMS256.txt" -UseBasicParsing).Content
    $escapedName = [regex]::Escape($archiveName)
    $checksumMatch = [regex]::Match($checksumText, "(?m)^([0-9a-fA-F]{64})\s+$escapedName$")
    if (-not $checksumMatch.Success) {
        throw "Node.js did not publish a checksum for $archiveName."
    }
    Assert-Sha256 $archivePath $checksumMatch.Groups[1].Value

    if (Test-Path -LiteralPath $stagingDirectory) {
        Remove-Item -LiteralPath $stagingDirectory -Recurse -Force
    }
    New-Item -ItemType Directory -Path $stagingDirectory | Out-Null
    Expand-Archive -LiteralPath $archivePath -DestinationPath $stagingDirectory -Force
    $extractedDirectory = Get-ChildItem -LiteralPath $stagingDirectory -Directory | Select-Object -First 1
    if (-not $extractedDirectory) {
        throw "The Node.js archive did not contain the expected directory."
    }
    if (Test-Path -LiteralPath $nodeDirectory) {
        Remove-Item -LiteralPath $nodeDirectory -Recurse -Force
    }
    Move-Item -LiteralPath $extractedDirectory.FullName -Destination $nodeDirectory
    Remove-Item -LiteralPath $stagingDirectory -Recurse -Force
    Remove-Item -LiteralPath $archivePath -Force

    Write-Host "[OK] Portable Node.js $version is ready."
}

function Install-PortableGit {
    $architecture = Get-WindowsArchitecture
    $assetSuffix = if ($architecture -eq "arm64") { "arm64" } else { "64-bit" }
    $headers = @{ "User-Agent" = "AI-Photo-Editor-Setup" }
    $release = Invoke-RestMethod `
        -Uri "https://api.github.com/repos/git-for-windows/git/releases/latest" `
        -Headers $headers `
        -UseBasicParsing
    $asset = $release.assets |
        Where-Object {
            $_.name -match "^MinGit-.*-$assetSuffix\.zip$" -and
            $_.name -notmatch "busybox"
        } |
        Select-Object -First 1
    if (-not $asset) {
        throw "No compatible MinGit Windows package was found."
    }

    $downloadDirectory = Join-Path $RuntimeRoot "downloads"
    $archivePath = Join-Path $downloadDirectory $asset.name
    $stagingDirectory = Join-Path $RuntimeRoot "git-stage-$PID"
    $gitDirectory = Join-Path $RuntimeRoot "git"

    New-Item -ItemType Directory -Path $downloadDirectory -Force | Out-Null
    Invoke-Download $asset.browser_download_url $archivePath
    if ($asset.digest -match "^sha256:(.+)$") {
        Assert-Sha256 $archivePath $Matches[1]
    }
    else {
        throw "Git for Windows did not publish a SHA-256 checksum."
    }

    if (Test-Path -LiteralPath $stagingDirectory) {
        Remove-Item -LiteralPath $stagingDirectory -Recurse -Force
    }
    New-Item -ItemType Directory -Path $stagingDirectory | Out-Null
    Expand-Archive -LiteralPath $archivePath -DestinationPath $stagingDirectory -Force
    if (-not (Test-Path -LiteralPath (Join-Path $stagingDirectory "cmd\git.exe"))) {
        throw "The MinGit archive did not contain cmd\git.exe."
    }
    if (Test-Path -LiteralPath $gitDirectory) {
        Remove-Item -LiteralPath $gitDirectory -Recurse -Force
    }
    Move-Item -LiteralPath $stagingDirectory -Destination $gitDirectory
    Remove-Item -LiteralPath $archivePath -Force

    Write-Host "[OK] Portable Git $($release.tag_name) is ready."
}

New-Item -ItemType Directory -Path $RuntimeRoot -Force | Out-Null

if ($EnsureGit) {
    $localGit = Join-Path $RuntimeRoot "git\cmd\git.exe"
    $systemGit = Get-Command git.exe -ErrorAction SilentlyContinue
    if ((-not $ForcePortable) -and $systemGit) {
        Write-Host "[OK] Git is already installed."
    }
    elseif (Test-Path -LiteralPath $localGit -PathType Leaf) {
        Write-Host "[OK] Portable Git is already ready."
    }
    else {
        Install-PortableGit
    }
}

if ($EnsureNode) {
    $localNode = Join-Path $RuntimeRoot "node\node.exe"
    $systemNode = Get-Command node.exe -ErrorAction SilentlyContinue
    if ((-not $ForcePortable) -and $systemNode -and (Test-NodeExecutable $systemNode.Source)) {
        Write-Host "[OK] Node.js 24.6 or newer is already installed."
    }
    elseif (Test-NodeExecutable $localNode) {
        Write-Host "[OK] Portable Node.js is already ready."
    }
    else {
        Install-PortableNode
    }
}
