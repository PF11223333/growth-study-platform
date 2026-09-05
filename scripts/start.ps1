$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$address = 'http://127.0.0.1:4186'
try { $health = Invoke-RestMethod "$address/api/health" -TimeoutSec 2 } catch { $health = $null }
if (-not $health.ok) {
  if (Get-NetTCPConnection -LocalPort 4186 -State Listen -ErrorAction SilentlyContinue) { throw '4186 端口被其他服务占用，请先检查。' }
  if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'dist/index.html'))) { throw '请先在项目目录运行 npm run build。' }
  $nodePath = (Get-Command node).Source
  Start-Process -FilePath $nodePath -ArgumentList 'server/index.mjs' -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $projectRoot 'data/server.log') -RedirectStandardError (Join-Path $projectRoot 'data/server-error.log')
  for ($attempt = 0; $attempt -lt 20; $attempt++) {
    Start-Sleep -Milliseconds 300
    try { $health = Invoke-RestMethod "$address/api/health" -TimeoutSec 2; if ($health.ok) { break } } catch {}
  }
  if (-not $health.ok) { throw '本地服务尚未就绪，请查看 data/server-error.log。' }
}
Start-Process $address
