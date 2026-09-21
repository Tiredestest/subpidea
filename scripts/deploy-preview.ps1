$ErrorActionPreference = 'Stop'
Push-Location (Join-Path $PSScriptRoot '..')
try {
    $deploymentOutput = & npx.cmd --yes vercel@59.23.2 deploy --yes --target preview --scope tiredestests-projects
    if ($LASTEXITCODE -ne 0) { throw 'Preview deployment failed; the existing alias was not changed.' }
    $deploymentOutput | Write-Output
    $deploymentMatches = [regex]::Matches(($deploymentOutput -join "`n"), 'https://subpidea-[a-z0-9]+-tiredestests-projects\.vercel\.app')
    if ($deploymentMatches.Count -eq 0) { throw 'No deployment URL found; the existing alias was not changed.' }
    $deploymentUrl = $deploymentMatches[$deploymentMatches.Count - 1].Value
    & npx.cmd --yes vercel@59.23.2 alias set $deploymentUrl subpidea-preview-tiredestests-projects.vercel.app --scope tiredestests-projects
    if ($LASTEXITCODE -ne 0) { throw "Deployment succeeded at $deploymentUrl, but alias update failed." }
} finally { Pop-Location }
