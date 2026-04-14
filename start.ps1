$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$entry = Join-Path $root "index.html"
$port = 4173
$url = "http://127.0.0.1:$port/"

if (-not (Test-Path -LiteralPath $entry)) {
  Write-Error "index.html 파일을 찾을 수 없습니다."
  exit 1
}

function Test-LocalServer {
  param(
    [string]$TargetUrl
  )

  try {
    $response = Invoke-WebRequest -Uri $TargetUrl -UseBasicParsing -TimeoutSec 1
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
  } catch {
    return $false
  }
}

if (-not (Test-LocalServer -TargetUrl $url)) {
  $pythonArgs = "-m http.server $port --bind 127.0.0.1 --directory `"$root`""
  Start-Process python -ArgumentList $pythonArgs -WorkingDirectory $root | Out-Null

  for ($index = 0; $index -lt 20; $index += 1) {
    Start-Sleep -Milliseconds 150

    if (Test-LocalServer -TargetUrl $url) {
      break
    }
  }
}

if (-not (Test-LocalServer -TargetUrl $url)) {
  Write-Error "로컬 서버를 시작하지 못했습니다."
  exit 1
}

Start-Process $url
