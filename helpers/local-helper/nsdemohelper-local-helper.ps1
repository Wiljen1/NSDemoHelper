$ErrorActionPreference = "Stop"
$Port = [int]($env:NSDH_HELPER_PORT)
if (-not $Port) { $Port = 4173 }
$ApexOrigin = $env:NSDH_APEX_ORIGIN
if (-not $ApexOrigin) { $ApexOrigin = "https://apex.oraclecorp.com" }
$State = @{
  guide = ""
  scRunbook = ""
  assetGenerationPrompt = ""
  setupPrompt = ""
  dryRunCreationPrompt = ""
  preDemoIntelligence = $null
  demoIntelligence = $null
  lastGeneratedAt = ""
}

function Find-Codex {
  if ($env:CODEX_BIN -and (Test-Path $env:CODEX_BIN)) { return $env:CODEX_BIN }
  $cmd = Get-Command codex -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $cmdExe = Get-Command codex.exe -ErrorAction SilentlyContinue
  if ($cmdExe) { return $cmdExe.Source }
  return $null
}

function Get-CodexStatus {
  $cmd = Find-Codex
  if (-not $cmd) {
    return @{
      ok = $true
      available = $false
      code = "CODEX_NOT_AVAILABLE"
      message = "Codex was not found. Open Codex or add it to PATH, then test again."
    }
  }
  try {
    $version = & $cmd --version 2>&1
    return @{
      ok = $true
      available = ($LASTEXITCODE -eq 0)
      command = $cmd
      version = ($version -join "`n")
      code = $(if ($LASTEXITCODE -eq 0) { "CODEX_LOCAL_CONNECTED" } else { "CODEX_NOT_AVAILABLE" })
      message = $(if ($LASTEXITCODE -eq 0) { "Codex is available." } else { "Codex responded with a non-zero status." })
    }
  } catch {
    return @{
      ok = $true
      available = $false
      command = $cmd
      code = "CODEX_NOT_AVAILABLE"
      message = $_.Exception.Message
    }
  }
}

function ConvertTo-JsonSafe($value) {
  return ($value | ConvertTo-Json -Depth 20 -Compress)
}

function Write-Json($Context, $Payload, $StatusCode = 200) {
  $origin = $Context.Request.Headers["Origin"]
  if (-not $origin) { $origin = $ApexOrigin }
  if (($origin -ne $ApexOrigin) -and ($origin -notmatch "^https?://(localhost|127\.0\.0\.1)(:\d+)?$")) {
    $origin = $ApexOrigin
  }
  $Context.Response.StatusCode = $StatusCode
  $Context.Response.ContentType = "application/json"
  $Context.Response.Headers.Add("Access-Control-Allow-Origin", $origin)
  $Context.Response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
  $Context.Response.Headers.Add("Access-Control-Allow-Headers", "content-type, x-demo-helper-session-id, x-demo-helper-anonymous-user-id, x-demo-helper-admin-session")
  $Context.Response.Headers.Add("Access-Control-Allow-Private-Network", "true")
  $Context.Response.Headers.Add("Vary", "Origin")
  $bytes = [Text.Encoding]::UTF8.GetBytes((ConvertTo-JsonSafe $Payload))
  $Context.Response.ContentLength64 = $bytes.Length
  $Context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  $Context.Response.Close()
}

function Read-BodyJson($Context) {
  if ($Context.Request.HasEntityBody -eq $false) { return @{} }
  $reader = New-Object IO.StreamReader($Context.Request.InputStream, $Context.Request.ContentEncoding)
  $raw = $reader.ReadToEnd()
  if (-not $raw) { return @{} }
  try { return ($raw | ConvertFrom-Json -Depth 20) } catch { return @{} }
}

function Get-InputContext($Body) {
  return @{
    companyName = $Body.companyName
    website = $(if ($Body.companyUrl) { $Body.companyUrl } else { $Body.website })
    audience = $(if ($Body.audience) { $Body.audience } else { $Body.audienceType })
    segment = $(if ($Body.marketSegment) { $Body.marketSegment } else { $Body.targetSegment })
    industry = $Body.industry
    strategy = $Body.demoStrategy
    language = $(if ($Body.outputLanguage) { $Body.outputLanguage } else { "English" })
    competition = $Body.competition
    demoScope = $Body.demoScope
    demoRequest = $(if ($Body.topic) { $Body.topic } else { $Body.demoRequest })
    preDemoNotes = $Body.preDemoNotes
    additionalContext = $Body.additionalContext
  }
}

function Invoke-CodexText($Prompt) {
  $status = Get-CodexStatus
  if (-not $status.available) {
    return @{ ok = $false; code = "CODEX_NOT_AVAILABLE"; error = $status.message }
  }
  $workDir = Join-Path $env:TEMP ("nsdh-helper-" + [Guid]::NewGuid().ToString("N"))
  New-Item -ItemType Directory -Path $workDir | Out-Null
  $outFile = Join-Path $workDir "codex-output.txt"
  $args = @(
    "--ask-for-approval", "never",
    "exec",
    "-C", $workDir,
    "--sandbox", "read-only",
    "--skip-git-repo-check",
    "--output-last-message", $outFile,
    "-"
  )
  try {
    $psi = New-Object Diagnostics.ProcessStartInfo
    $psi.FileName = $status.command
    foreach ($arg in $args) { [void]$psi.ArgumentList.Add($arg) }
    $psi.RedirectStandardInput = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.UseShellExecute = $false
    $proc = New-Object Diagnostics.Process
    $proc.StartInfo = $psi
    [void]$proc.Start()
    $proc.StandardInput.Write($Prompt)
    $proc.StandardInput.Close()
    if (-not $proc.WaitForExit(240000)) {
      try { $proc.Kill() } catch {}
      return @{ ok = $false; code = "GENERATION_TIMEOUT"; error = "Codex generation timed out." }
    }
    $text = ""
    if (Test-Path $outFile) { $text = Get-Content -Raw -LiteralPath $outFile }
    if (-not $text) { $text = $proc.StandardOutput.ReadToEnd() + $proc.StandardError.ReadToEnd() }
    return @{ ok = $true; text = $text }
  } catch {
    return @{ ok = $false; code = "HELPER_INVALID_RESPONSE"; error = $_.Exception.Message }
  } finally {
    Remove-Item -Recurse -Force $workDir -ErrorAction SilentlyContinue
  }
}

function Invoke-HelperTask($Body, $Task, $Title) {
  $context = Get-InputContext $Body
  $prompt = "You are the Codex backbone for NS DemoHelper. Return concise markdown or valid JSON where useful.`nTask: $Task`nContext:`n$($context | ConvertTo-Json -Depth 20)"
  $result = Invoke-CodexText $prompt
  if (-not $result.ok) { return @{ ok = $true; source = "local-helper-codex"; title = $Title; prompt = ""; error = $result.error; code = $result.code } }
  return @{ ok = $true; source = "local-helper-codex"; title = $Title; prompt = $result.text; guide = $result.text }
}

function Invoke-DiscoveryPrep($Body) {
  $result = Invoke-HelperTask $Body "Create targeted Discovery Prep questions only. Do not create a demo story, PowerPoint prompt, dataset setup prompt, or runbook. Include Executive Summary, Priority Discovery Questions, Questions By Topic, Stakeholder-Specific Questions, Gap Validation Questions, Demo-Relevance Questions, Risks / Watchouts, Suggested Opening Question, and Suggested Closing Question." "Discovery Prep"
  return @{
    ok = $true
    source = "local-helper-codex"
    discoveryPrep = @{
      markdown = $result.prompt
      generatedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
      source = "local-helper-codex"
    }
    error = $result.error
    code = $result.code
  }
}

function Get-ManifestPayload {
  return @{
    ok = $true
    featureFlags = @{ liveDemoFunctionality = $false }
    appVersion = "local-helper-prototype"
    buildMetadata = @{ version = "local-helper-prototype"; environment = "local-helper"; profile = "mvp" }
    manifest = @{ title = "NS DemoHelper Local Helper"; segments = @(); context = @{}; defaults = @{} }
    versions = @()
    guide = $State.guide
    guideOutputs = @{
      scRunbook = $State.scRunbook
      assetGenerationPrompt = $State.assetGenerationPrompt
      dryRunCreationPrompt = $State.dryRunCreationPrompt
      liveDemoFunctionality = $false
    }
    setupPrompt = @{ prompt = $State.setupPrompt; account = @{}; setupPlan = @{ items = @() } }
    preDemoIntelligence = $State.preDemoIntelligence
    intelligence = $State.demoIntelligence
  }
}

$listener = [Net.HttpListener]::new()
$prefix = "http://127.0.0.1:$Port/"
$listener.Prefixes.Add($prefix)
$listener.Start()
Write-Host "NS DemoHelper Local Helper"
Write-Host "Listening on $prefix"
Write-Host "APEX origin allowed: $ApexOrigin"
Write-Host ("Codex status: " + (Get-CodexStatus).message)
Write-Host "Keep this window open while using the APEX app. Press Ctrl+C to stop."

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $path = $ctx.Request.Url.AbsolutePath
  if ($ctx.Request.HttpMethod -eq "OPTIONS") {
    Write-Json $ctx @{ ok = $true } 204
    continue
  }
  try {
    if ($ctx.Request.HttpMethod -eq "GET") {
      switch -Regex ($path) {
        "^/api/helper/status" { Write-Json $ctx @{ ok = $true; helper = @{ name = "NS DemoHelper Local Helper"; mode = "local-helper"; port = $Port }; runtime = @{ environment = "local-helper"; profile = "mvp" }; message = "Local helper is running." }; continue }
        "^/api/platform/status" { Write-Json $ctx @{ ok = $true; runtime = @{ environment = "local-helper"; profile = "mvp"; appVersion = "local-helper-prototype" }; provider = @{ active = "Codex"; mode = "Local Helper" } }; continue }
        "^/api/codex/status" { Write-Json $ctx (Get-CodexStatus); continue }
        "^/api/manifest" { Write-Json $ctx (Get-ManifestPayload); continue }
        "^/api/sc-guide" { Write-Json $ctx @{ ok = $true; guide = $State.guide; guideOutputs = (Get-ManifestPayload).guideOutputs }; continue }
        "^/api/setup-prompt" { Write-Json $ctx @{ ok = $true; setupPrompt = (Get-ManifestPayload).setupPrompt }; continue }
      }
    }
    if ($ctx.Request.HttpMethod -eq "POST") {
      $body = Read-BodyJson $ctx
      switch -Regex ($path) {
        "^/api/(pre-demo-score|pre-demo-intelligence)" {
          $result = Invoke-HelperTask $body "Score pre-demo discovery quality and return gaps, risks, recommendations, and follow-up questions." "Pre-demo intelligence"
          $inputContext = Get-InputContext $body
          $State.preDemoIntelligence = @{
            overall_score = 0
            readiness_label = "Review needed"
            summary = $result.prompt
            strongest_area = ""
            biggest_risk = ""
            next_best_question = ""
            missing_discovery_items = @()
            recommended_follow_up_questions = @()
            recommendations = @()
            heatmap = @()
            website_context = @{ summary = ""; interesting_points = @(); contradictions = @() }
            metadata = @{
              customer_name = $(if ($inputContext.companyName) { $inputContext.companyName } else { "Current prospect" })
              audience_type = $inputContext.audience
              target_segment = $inputContext.segment
              industry = $inputContext.industry
              demo_strategy = $inputContext.strategy
            }
          }
          Write-Json $ctx @{ ok = $true; source = "local-helper-codex"; preDemoIntelligence = $State.preDemoIntelligence; summary = $result.prompt; error = $result.error; code = $result.code }
          continue
        }
        "^/api/discovery-prep" {
          Write-Json $ctx (Invoke-DiscoveryPrep $body)
          continue
        }
        "^/api/(demo-runbook|learn)" {
          $result = Invoke-HelperTask $body "Create the demo playbook, story/runbook, setup prompt, asset prompt, dry-run prompt, and intelligence summary." "Demo runbook"
          $State.guide = $result.prompt
          $State.scRunbook = $result.prompt
          Write-Json $ctx (Get-ManifestPayload)
          continue
        }
        "^/api/ppt-prompt" { Write-Json $ctx (Invoke-HelperTask $body "Create a PowerPoint/demo asset generation prompt." "Demo asset / PowerPoint prompt"); continue }
        "^/api/(dataset-enhancement|dataset-analysis)" { Write-Json $ctx (Invoke-HelperTask $body "Create a dataset enhancement prompt." "Dataset enhancement prompt"); continue }
        "^/api/generate" { Write-Json $ctx (Invoke-HelperTask $body "Create the requested demo helper output." "Generation output"); continue }
        "^/api/codex/stop" { Write-Json $ctx @{ ok = $true; message = "No active helper request to stop." }; continue }
      }
    }
    Write-Json $ctx @{ ok = $false; error = "Unknown helper endpoint."; code = "HELPER_INVALID_RESPONSE" } 404
  } catch {
    Write-Json $ctx @{ ok = $false; error = $_.Exception.Message; code = "HELPER_INVALID_RESPONSE" } 500
  }
}
