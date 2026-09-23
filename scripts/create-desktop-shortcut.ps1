$ErrorActionPreference = "Stop"

$projectDirectory = $PSScriptRoot | Split-Path -Parent
$launcherPath = Join-Path $PSScriptRoot "start-adminflow.ps1"
$desktopDirectory = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktopDirectory "AdminFlow.lnk"
$iconPath = Join-Path $projectDirectory "src\app\favicon.ico"

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "powershell.exe"
$shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$launcherPath`""
$shortcut.WorkingDirectory = $projectDirectory
$shortcut.Description = "Jalankan aplikasi AdminFlow"
$shortcut.WindowStyle = 1
$shortcut.IconLocation = "$iconPath,0"
$shortcut.Save()

Write-Output $shortcutPath
