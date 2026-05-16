$ErrorActionPreference = "Stop"

$ProjectRoot = $PSScriptRoot
$OutputDir = Join-Path $ProjectRoot "dist"
$ZipName = "yandex-music-lyrics.zip"
$ZipPath = Join-Path $OutputDir $ZipName

# Файлы, входящие в расширение
$ExtensionFiles = @(
    "manifest.json",
    "content.js",
    "background.js"
)

# Очистка предыдущей сборки
if (Test-Path $OutputDir) {
    Remove-Item $OutputDir -Recurse -Force
}
New-Item -ItemType Directory -Path $OutputDir | Out-Null

# Проверяем наличие всех файлов
foreach ($file in $ExtensionFiles) {
    $fullPath = Join-Path $ProjectRoot $file
    if (-not (Test-Path $fullPath)) {
        Write-Error "Missing required file: $file"
        exit 1
    }
}

# Собираем ZIP
$filesToCompress = $ExtensionFiles | ForEach-Object { Join-Path $ProjectRoot $_ }
Compress-Archive -Path $filesToCompress -DestinationPath $ZipPath -Force

$sizeKB = [math]::Round((Get-Item $ZipPath).Length / 1024, 1)
Write-Host ""
Write-Host "Build successful!" -ForegroundColor Green
Write-Host "  Output: $ZipPath"
Write-Host "  Size:   ${sizeKB} KB"
Write-Host "  Files:  $($ExtensionFiles -join ', ')"
Write-Host ""
Write-Host "Ready to upload to Chrome Web Store." -ForegroundColor Cyan
