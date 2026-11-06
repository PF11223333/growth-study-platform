$ErrorActionPreference = 'Stop'
$platformRoot = Split-Path -Parent $PSScriptRoot
$desktopDir = [Environment]::GetFolderPath('Desktop')
$iconFile = Join-Path $platformRoot 'assets/growth-platform-v50.ico'
if (-not (Test-Path -LiteralPath $iconFile)) {
  Add-Type -AssemblyName System.Drawing
  $pngFile = Join-Path $platformRoot 'public/references/app-icon.png'
  $original = [Drawing.Image]::FromFile($pngFile)
  $bitmap = [Drawing.Bitmap]::new($original,256,256)
  $buffer = [IO.MemoryStream]::new()
  try { $bitmap.Save($buffer,[Drawing.Imaging.ImageFormat]::Png); $pngBytes=$buffer.ToArray() } finally {$bitmap.Dispose();$original.Dispose();$buffer.Dispose()}
  New-Item -ItemType Directory -Path (Split-Path $iconFile) -Force | Out-Null
  $writer = [IO.BinaryWriter]::new([IO.File]::Create($iconFile))
  try { $writer.Write([uint16]0);$writer.Write([uint16]1);$writer.Write([uint16]1);$writer.Write([uint32]0);$writer.Write([uint16]1);$writer.Write([uint16]32);$writer.Write([uint32]$pngBytes.Length);$writer.Write([uint32]22);$writer.Write($pngBytes) } finally {$writer.Dispose()}
}
$shortcutFile = Join-Path $desktopDir '向内生长 · 学习与复盘.lnk'
$ws = New-Object -ComObject WScript.Shell
$link = $ws.CreateShortcut($shortcutFile)
$link.TargetPath = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$launcherFile = Join-Path $platformRoot 'scripts/start.ps1'
$link.Arguments = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$launcherFile`""
$link.WorkingDirectory = $platformRoot
$link.IconLocation = "$iconFile,0"
$link.Description = '向内生长 · 学习、刷题、申论与复盘'
$link.WindowStyle = 7
$link.Save()
$readBack = $ws.CreateShortcut($shortcutFile)
if ($readBack.IconLocation -ne "$iconFile,0" -or -not (Test-Path -LiteralPath $readBack.TargetPath)) { throw '快捷方式回读失败' }
[pscustomobject]@{shortcut=$shortcutFile;icon=$readBack.IconLocation;target=$readBack.TargetPath} | ConvertTo-Json -Compress
