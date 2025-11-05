#!/usr/bin/env pwsh

<#
.SYNOPSIS
    Test script for OCR microservice that sends an image and returns the OCR result
.DESCRIPTION
    This script sends an image file to the OCR microservice API and displays the structured OCR result.
    Uses native PowerShell HTTP client for reliable multipart form data handling.
.PARAMETER ImagePath
    Path to the image file to process (JPEG/PNG, < 10MB)
.PARAMETER ServerUrl
    OCR service URL (default: http://localhost:8600)
.PARAMETER ReturnStrategy
    Return strategy: 'polling' or 'sse' (default: polling)
.EXAMPLE
    .\test-ocr.ps1 -ImagePath "test.1.jpg"
.EXAMPLE
    .\test-ocr.ps1 -ImagePath "test.1.jpg" -ReturnStrategy "sse"
.EXAMPLE
    .\test-ocr.ps1 -ImagePath "../../docs/document.png" -ServerUrl "http://192.168.1.100:8600" -ReturnStrategy "polling"
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$ImagePath,
    
    [Parameter(Mandatory=$false)]
    [string]$ServerUrl = "http://localhost:8600",
    
    [Parameter(Mandatory=$false)]
    [ValidateSet("polling", "sse")]
    [string]$ReturnStrategy = "polling"
)

# VALIDATE INPUT
if (-not (Test-Path $ImagePath)) {
    Write-Error "Image file not found: $ImagePath"
    exit 1
}

$fileInfo = Get-Item $ImagePath
$fileSizeMB = [math]::Round($fileInfo.Length / 1MB, 2)

if ($fileSizeMB -gt 10) {
    Write-Error "Image file too large: ${fileSizeMB}MB (max 10MB)"
    exit 1
}

$allowedExtensions = @('.jpg', '.jpeg', '.png')
if ($fileInfo.Extension.ToLower() -notin $allowedExtensions) {
    Write-Error "Unsupported file format: $($fileInfo.Extension). Supported: JPG, JPEG, PNG"
    exit 1
}

Write-Host "[OCR] Testing OCR Microservice" -ForegroundColor Cyan
Write-Host "[FILE] Image: $ImagePath ($fileSizeMB MB)" -ForegroundColor Gray
Write-Host "[SERVER] Server: $ServerUrl" -ForegroundColor Gray
Write-Host "[MODE] Return strategy: $ReturnStrategy" -ForegroundColor Gray

try {
    # CHECK SERVER STATUS
    Write-Host "[WAIT] Checking server status..." -ForegroundColor Yellow
    $statusCheck = Invoke-RestMethod -Uri "$ServerUrl/ocr/status" -Method GET -TimeoutSec 10
    Write-Host "[OK] Server is running" -ForegroundColor Green
    
    # PREPARE FORM DATA USING POWERSHELL NATIVE APPROACH
    Add-Type -AssemblyName System.Net.Http
    
    $httpClient = New-Object System.Net.Http.HttpClient
    $form = New-Object System.Net.Http.MultipartFormDataContent
    
    # ADD IMAGE FILE
    $fileStream = [System.IO.File]::OpenRead($ImagePath)
    $fileContent = New-Object System.Net.Http.StreamContent($fileStream)
    
    # SET CORRECT MIME TYPE BASED ON FILE EXTENSION
    $extension = [System.IO.Path]::GetExtension($ImagePath).ToLower()
    $mimeType = switch ($extension) {
        ".jpg" { "image/jpeg" }
        ".jpeg" { "image/jpeg" }
        ".png" { "image/png" }
        default { "image/jpeg" }
    }
    
    $fileContent.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse($mimeType)
    $form.Add($fileContent, "image", [System.IO.Path]::GetFileName($ImagePath))
    
    # ADD BODY JSON
    $bodyJson = "{`"returnStrategy`":`"$ReturnStrategy`"}"
    $bodyContent = New-Object System.Net.Http.StringContent($bodyJson)
    $form.Add($bodyContent, "body")
    
    Write-Host "[SEND] Sending multipart request..." -ForegroundColor Yellow
    
    # SEND REQUEST
    $response = $httpClient.PostAsync("$ServerUrl/ocr/process", $form).Result
    $responseContent = $response.Content.ReadAsStringAsync().Result
    
    # CLEANUP
    $fileStream.Close()
    $httpClient.Dispose()
    
    if ($response.IsSuccessStatusCode) {
        # PARSE RESPONSE
        $jobResponse = $responseContent | ConvertFrom-Json
        $jobId = $jobResponse.jobId
        
        Write-Host "[JOB] Started job: $jobId" -ForegroundColor Green
        
        if ($ReturnStrategy -eq "sse") {
            # SSE MODE - LISTEN FOR REAL-TIME PROGRESS
            Write-Host "[SSE] Connecting to progress stream..." -ForegroundColor Yellow
            $startTime = Get-Date
            
            try {
                # CREATE HTTP CLIENT FOR SSE
                $sseClient = New-Object System.Net.Http.HttpClient
                $sseClient.Timeout = [System.TimeSpan]::FromMinutes(10)
                
                # START SSE STREAM
                $sseResponse = $sseClient.GetAsync("$ServerUrl/ocr/progress/$jobId", [System.Net.Http.HttpCompletionOption]::ResponseHeadersRead).Result
                $sseStream = $sseResponse.Content.ReadAsStreamAsync().Result
                $sseReader = New-Object System.IO.StreamReader($sseStream)
                
                # PROCESS SSE EVENTS
                while (-not $sseReader.EndOfStream) {
                    $line = $sseReader.ReadLine()
                    
                    if ($line -match '^data: (.+)$') {
                        $eventData = $matches[1]
                        
                        # SKIP EMPTY DATA LINES
                        if ([string]::IsNullOrWhiteSpace($eventData)) {
                            continue
                        }
                        
                        try {
                            $eventObj = $eventData | ConvertFrom-Json
                            
                            switch ($eventObj.type) {
                                "progress" {
                                    $stage = if ($eventObj.stage) { $eventObj.stage } else { "unknown" }
                                    $percent = if ($eventObj.percent) { $eventObj.percent } else { 0 }
                                    Write-Host "  [PROGRESS] $stage`: $percent%" -ForegroundColor Gray
                                }
                                { $_ -in @("completed", "complete") } {
                                    $endTime = Get-Date
                                    $duration = ($endTime - $startTime).TotalSeconds
                                    
                                    Write-Host "[SUCCESS] OCR completed!" -ForegroundColor Green
                                    Write-Host "[TIME] Duration: $([math]::Round($duration, 2)) seconds" -ForegroundColor Gray
                                    
                                    # EXTRACT RESULTS FROM SSE EVENT
                                    $result = $eventObj.result
                                    $wordCount = $result.words.Count
                                    $lineCount = $result.lines.Count
                                    $paragraphCount = $result.paragraphs.Count
                                    $blockCount = $result.blocks.Count
                                    
                                    Write-Host "[RESULTS] OCR Results Summary:" -ForegroundColor Cyan
                                    Write-Host "  Words: $wordCount" -ForegroundColor White
                                    Write-Host "  Lines: $lineCount" -ForegroundColor White
                                    Write-Host "  Paragraphs: $paragraphCount" -ForegroundColor White
                                    Write-Host "  Blocks: $blockCount" -ForegroundColor White
                                    
                                    if ($wordCount -gt 0) {
                                        Write-Host "[TEXT] Extracted Text:" -ForegroundColor Cyan
                                        $allText = ($result.words | ForEach-Object { $_.data.text }) -join " "
                                        Write-Host $allText -ForegroundColor White
                                    }
                                    
                                    # SAVE RESULTS
                                    $outputFile = "ocr-result-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
                                    $result | ConvertTo-Json -Depth 10 | Out-File -FilePath $outputFile -Encoding UTF8
                                    Write-Host "[SAVE] Results saved to: $outputFile" -ForegroundColor Green
                                    
                                    # CLEANUP AND EXIT
                                    $sseReader.Close()
                                    $sseStream.Close()
                                    $sseResponse.Dispose()
                                    $sseClient.Dispose()
                                    exit 0
                                }
                                "failed" {
                                    $errorMsg = if ($eventObj.error) { $eventObj.error } else { "Unknown error" }
                                    Write-Host "[ERROR] OCR failed: $errorMsg" -ForegroundColor Red
                                    
                                    # CLEANUP AND EXIT
                                    $sseReader.Close()
                                    $sseStream.Close()
                                    $sseResponse.Dispose()
                                    $sseClient.Dispose()
                                    exit 1
                                }
                                "error" {
                                    $errorMsg = if ($eventObj.message) { $eventObj.message } else { "Unknown error" }
                                    Write-Host "[ERROR] SSE error: $errorMsg" -ForegroundColor Red
                                    
                                    # CLEANUP AND EXIT
                                    $sseReader.Close()
                                    $sseStream.Close()
                                    $sseResponse.Dispose()
                                    $sseClient.Dispose()
                                    exit 1
                                }
                                default {
                                    Write-Host "  [EVENT] $($eventObj.type)" -ForegroundColor Gray
                                }
                            }
                        } catch {
                            Write-Host "  [DEBUG] Invalid JSON in SSE event: $eventData" -ForegroundColor DarkGray
                        }
                    }
                }
                
                # IF WE GET HERE, SSE STREAM ENDED WITHOUT COMPLETION
                Write-Host "[ERROR] SSE stream ended unexpectedly" -ForegroundColor Red
                $sseReader.Close()
                $sseStream.Close()
                $sseResponse.Dispose()
                $sseClient.Dispose()
                exit 1
                
            } catch {
                Write-Host "[ERROR] SSE connection failed: $($_.Exception.Message)" -ForegroundColor Red
                if ($sseReader) { $sseReader.Close() }
                if ($sseStream) { $sseStream.Close() }
                if ($sseResponse) { $sseResponse.Dispose() }
                if ($sseClient) { $sseClient.Dispose() }
                exit 1
            }
            
        } else {
            # POLLING MODE - ORIGINAL BEHAVIOR
            Write-Host "[POLL] Waiting for completion..." -ForegroundColor Yellow
            $maxAttempts = 60
            $attempt = 0
            $startTime = Get-Date
            
            do {
                Start-Sleep -Seconds 3
                $attempt++
                
                $statusResponse = Invoke-RestMethod -Uri "$ServerUrl/ocr/status/$jobId" -Method GET -TimeoutSec 30
                
                Write-Host "  [STATUS] $($statusResponse.status) (attempt $attempt)" -ForegroundColor Gray
                
                if ($statusResponse.status -eq "completed") {
                    $endTime = Get-Date
                    $duration = ($endTime - $startTime).TotalSeconds
                    
                    Write-Host "[SUCCESS] OCR completed!" -ForegroundColor Green
                    Write-Host "[TIME] Duration: $([math]::Round($duration, 2)) seconds" -ForegroundColor Gray
                    
                    # DISPLAY RESULTS
                    $result = $statusResponse.result
                    $wordCount = $result.words.Count
                    $lineCount = $result.lines.Count
                    $paragraphCount = $result.paragraphs.Count
                    $blockCount = $result.blocks.Count
                    
                    Write-Host "[RESULTS] OCR Results Summary:" -ForegroundColor Cyan
                    Write-Host "  Words: $wordCount" -ForegroundColor White
                    Write-Host "  Lines: $lineCount" -ForegroundColor White
                    Write-Host "  Paragraphs: $paragraphCount" -ForegroundColor White
                    Write-Host "  Blocks: $blockCount" -ForegroundColor White
                    
                    if ($wordCount -gt 0) {
                        Write-Host "[TEXT] Extracted Text:" -ForegroundColor Cyan
                        $allText = ($result.words | ForEach-Object { $_.data.text }) -join " "
                        Write-Host $allText -ForegroundColor White
                    }
                    
                    # SAVE RESULTS
                    $outputFile = "ocr-result-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
                    $result | ConvertTo-Json -Depth 10 | Out-File -FilePath $outputFile -Encoding UTF8
                    Write-Host "[SAVE] Results saved to: $outputFile" -ForegroundColor Green
                    
                    exit 0
                } elseif ($statusResponse.status -eq "failed") {
                    Write-Host "[ERROR] OCR failed: $($statusResponse.error)" -ForegroundColor Red
                    exit 1
                }
                
            } while ($attempt -lt $maxAttempts)
            
            Write-Host "[TIMEOUT] OCR processing timed out" -ForegroundColor Red
            exit 1
        }
        
    } else {
        Write-Host "[ERROR] HTTP $($response.StatusCode): $responseContent" -ForegroundColor Red
        exit 1
    }
    
} catch {
    Write-Host "[ERROR] Test failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($fileStream) { $fileStream.Close() }
    if ($httpClient) { $httpClient.Dispose() }
    exit 1
}