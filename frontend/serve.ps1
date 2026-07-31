Write-Host "Starting PayFlow frontend static server on http://localhost:5500 ..." -ForegroundColor Cyan
Set-Location $PSScriptRoot
if (Get-Command python -ErrorAction SilentlyContinue) {
    python -m http.server 5500
} elseif (Get-Command py -ErrorAction SilentlyContinue) {
    py -m http.server 5500
} else {
    Write-Host "Python not found. Falling back to 'npx serve'." -ForegroundColor Yellow
    npx --yes serve -l 5500 .
}

