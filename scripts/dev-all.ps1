$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$python = Join-Path $root "venv\Scripts\python.exe"
$aiUrl = "http://127.0.0.1:8000/health"
$nextPort = 3000
$aiJob = $null
$startedAiHere = $false

function Test-AiHealth {
  try {
    $response = Invoke-RestMethod -Uri $aiUrl -TimeoutSec 2
    return $response.status -eq "ok"
  } catch {
    return $false
  }
}

function Get-PortProcessIds {
  param([int]$Port)

  try {
    $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop
    return @($connections | Select-Object -ExpandProperty OwningProcess -Unique)
  } catch {
    return @()
  }
}

Set-Location $root

if (-not (Test-Path $python)) {
  Write-Host "Python venv was not found. Run: python -m venv venv" -ForegroundColor Red
  exit 1
}

$nextProcessIds = Get-PortProcessIds -Port $nextPort
if ($nextProcessIds.Count -gt 0) {
  Write-Host "Port $nextPort is already in use by process id(s): $($nextProcessIds -join ', ')." -ForegroundColor Yellow
  Write-Host "Stop the existing Next.js dev server, then run: npm run dev:all" -ForegroundColor Yellow
  exit 1
}

if (Test-AiHealth) {
  Write-Host "AI service is already running on port 8000." -ForegroundColor Green
} else {
  Write-Host "Starting AI service on port 8000..." -ForegroundColor Cyan

  $aiJob = Start-Job -Name "grad-b2b-ai" -ArgumentList $root, $python -ScriptBlock {
    param($rootPath, $pythonPath)
    Set-Location $rootPath
    & $pythonPath -m uvicorn app:app --host 127.0.0.1 --port 8000
  }
  $startedAiHere = $true

  $ready = $false
  for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Milliseconds 500

    if (Test-AiHealth) {
      $ready = $true
      break
    }

    if ($aiJob.State -ne "Running") {
      Receive-Job $aiJob
      throw "AI service stopped before it became ready."
    }
  }

  if (-not $ready) {
    if ($aiJob) {
      Receive-Job $aiJob -ErrorAction SilentlyContinue
      Stop-Job $aiJob -ErrorAction SilentlyContinue
      Remove-Job $aiJob -ErrorAction SilentlyContinue
    }
    throw "AI service did not become ready on port 8000."
  }

  Write-Host "AI service is ready." -ForegroundColor Green
}

try {
  npm run dev
} finally {
  if ($startedAiHere -and $aiJob) {
    Write-Host "Stopping AI service..." -ForegroundColor Yellow
    Stop-Job $aiJob -ErrorAction SilentlyContinue
    Remove-Job $aiJob -ErrorAction SilentlyContinue
  }
}
