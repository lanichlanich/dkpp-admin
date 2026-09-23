$ErrorActionPreference = "Stop"

$projectDirectory = $PSScriptRoot | Split-Path -Parent
$dashboardUrl = "http://localhost:3000/dashboard"
$existingServer = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue

if (-not $existingServer) {
  $serverCommand = "cd /d `"$projectDirectory`" && npm.cmd run dev -- --hostname 0.0.0.0"
  Start-Process -FilePath "cmd.exe" -ArgumentList "/k", $serverCommand -WorkingDirectory $projectDirectory -WindowStyle Hidden | Out-Null

  $serverReady = $false
  for ($attempt = 0; $attempt -lt 60; $attempt++) {
    Start-Sleep -Milliseconds 500
    try {
      $response = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 2
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        $serverReady = $true
        break
      }
    }
    catch {
      # Server masih dalam proses startup.
    }
  }

  if (-not $serverReady) {
    Add-Type -AssemblyName PresentationFramework
    [System.Windows.MessageBox]::Show(
      "Server AdminFlow belum siap. Periksa jendela terminal untuk detail error.",
      "AdminFlow",
      "OK",
      "Warning"
    ) | Out-Null
    exit 1
  }
}

Start-Process $dashboardUrl
