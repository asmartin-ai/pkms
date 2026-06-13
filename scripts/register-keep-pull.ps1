# Register the scheduled Google Keep pull (build-plan slice 4).
# Run AFTER `pkms ingest keep` has connected once (docs/keep-setup.md).
# Re-running replaces the task. Remove with:
#   Unregister-ScheduledTask -TaskName "PKMS keep pull" -Confirm:$false

$ErrorActionPreference = "Stop"

$pkms = "K:\Projects\PKMS\bin\pkms.cmd"
if (-not (Test-Path "K:\Projects\PKMS\.secrets\keep-master-token")) {
    Write-Host "No master token yet - do docs/keep-setup.md step 1-3 first." -ForegroundColor Yellow
    exit 1
}

$action = New-ScheduledTaskAction -Execute $pkms -Argument "ingest keep"
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) `
    -RepetitionInterval (New-TimeSpan -Hours 4) -RepetitionDuration ([TimeSpan]::MaxValue)
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable `
    -DontStopOnIdleEnd -ExecutionTimeLimit (New-TimeSpan -Minutes 10) `
    -MultipleInstances IgnoreNew

Register-ScheduledTask -TaskName "PKMS keep pull" -Action $action `
    -Trigger $trigger -Settings $settings -Force | Out-Null

Write-Host "Registered: 'PKMS keep pull' every 4h (runs hidden; skips quietly when offline)."
Write-Host "Each pull's result line also lands in today's pkms view via the inbox count."
