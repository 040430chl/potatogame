$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$entry = Join-Path $root "index.html"

if (-not (Test-Path -LiteralPath $entry)) {
  Write-Error "index.html 파일을 찾을 수 없습니다."
  exit 1
}

Start-Process $entry
