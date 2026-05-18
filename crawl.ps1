# Supermarket Price Crawler + Database Import - PowerShell Version
$ErrorActionPreference = "Stop"

$PROJECT_DIR = "a:\vs code\fullstack\as\SmartCart"
$TARGET_DIR = "$PROJECT_DIR\my_prices"
$SERVER_DIR = "$PROJECT_DIR\server"

Write-Host "=== Starting Supermarket Data Update Process ===" -ForegroundColor Cyan
Write-Host "Timestamp: $(Get-Date)" -ForegroundColor Gray

# Step 1: Prepare directory
if (-not (Test-Path $TARGET_DIR)) {
    Write-Host "[1/4] Creating directory: $TARGET_DIR" -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $TARGET_DIR -Force | Out-Null
} else {
    Write-Host "[1/4] Cleaning old files in $TARGET_DIR..." -ForegroundColor Yellow
    Remove-Item -Path "$TARGET_DIR\*" -Recurse -Force -ErrorAction SilentlyContinue
}

# Step 2: Run Docker crawler
Write-Host "[2/4] Starting Docker crawler (this may take 10-30 minutes)..." -ForegroundColor Yellow
& "C:\Program Files\Docker\Docker\resources\bin\docker.exe" run --rm -v "${TARGET_DIR}:/usr/src/app/dumps" erlichsefi/israeli-supermarket-scarpers:latest

if ($LASTEXITCODE -ne 0) {
    Write-Error "Crawler failed with exit code: $LASTEXITCODE"
    exit $LASTEXITCODE
}

Write-Host "[3/4] Crawler completed! Files downloaded to: $TARGET_DIR" -ForegroundColor Green

# Step 3: Import to database
Write-Host "[4/4] Importing prices to database..." -ForegroundColor Yellow
Set-Location $SERVER_DIR
node db/run-parser.js

if ($LASTEXITCODE -ne 0) {
    Write-Error "Database import failed with exit code: $LASTEXITCODE"
    exit $LASTEXITCODE
}

Write-Host "=== Process Completed Successfully! ===" -ForegroundColor Green
Write-Host "Database updated with fresh supermarket prices." -ForegroundColor Green
exit 0
