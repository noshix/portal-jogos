param(
  [int]$Port = 8080
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$palavroRoot = Join-Path $projectRoot "jogos\\palavro"
$dataRoot = Join-Path $palavroRoot "data"

function Normalize-Word {
  param([string]$Value)

  if ($null -eq $Value) {
    return ""
  }

  $normalized = $Value.Normalize([Text.NormalizationForm]::FormD)
  $withoutMarks = [regex]::Replace($normalized, "\p{Mn}", "")
  return ([regex]::Replace($withoutMarks.ToUpperInvariant(), "[^A-Z]", ""))
}

function To-UInt32 {
  param([long]$Value)
  return [uint32]($Value -band 0xFFFFFFFFL)
}

function Invoke-IMul {
  param([uint32]$A, [uint32]$B)
  return [uint32]((([uint64]$A * [uint64]$B) -band 0xFFFFFFFFL))
}

function Get-SeedHash {
  param([string]$Seed)

  $h = To-UInt32 (1779033703 -bxor $Seed.Length)

  for ($index = 0; $index -lt $Seed.Length; $index += 1) {
    $charCode = [int][char]$Seed[$index]
    $h = Invoke-IMul (To-UInt32 ($h -bxor $charCode)) ([uint32]3432918353)
    $h = To-UInt32 ((($h -shl 13) -bor ($h -shr 19)))
  }

  $h = Invoke-IMul (To-UInt32 ($h -bxor ($h -shr 16))) ([uint32]2246822507)
  $h = Invoke-IMul (To-UInt32 ($h -bxor ($h -shr 13))) ([uint32]3266489909)
  $h = To-UInt32 ($h -bxor ($h -shr 16))
  return $h
}

function New-Mulberry32State {
  param([uint32]$Seed)
  return @{ Seed = $Seed }
}

function Get-Mulberry32Value {
  param([hashtable]$State)

  $State.Seed = To-UInt32 ([long]$State.Seed + 0x6D2B79F5L)
  $t = [uint32]$State.Seed
  $t = Invoke-IMul (To-UInt32 ($t -bxor ($t -shr 15))) (To-UInt32 ($t -bor 1))
  $mix = To-UInt32 ([long]$t + [long](Invoke-IMul (To-UInt32 ($t -bxor ($t -shr 7))) (To-UInt32 ($t -bor 61))))
  $t = To-UInt32 ($t -bxor $mix)
  $final = To-UInt32 ($t -bxor ($t -shr 14))
  return ([double]$final / 4294967296.0)
}

function Shuffle-WithSeed {
  param([object[]]$List, [string]$SeedLabel)

  $copy = New-Object System.Collections.Generic.List[object]
  foreach ($item in $List) {
    [void]$copy.Add($item)
  }

  $state = New-Mulberry32State (Get-SeedHash $SeedLabel)

  for ($index = $copy.Count - 1; $index -gt 0; $index -= 1) {
    $swapIndex = [Math]::Floor((Get-Mulberry32Value $state) * ($index + 1))
    $temp = $copy[$index]
    $copy[$index] = $copy[$swapIndex]
    $copy[$swapIndex] = $temp
  }

  return $copy.ToArray()
}

function Get-BrasiliaDateParts {
  param([datetime]$ReferenceDate = (Get-Date))

  $shiftedUtc = $ReferenceDate.ToUniversalTime().AddHours(-3)

  return @{
    Year = $shiftedUtc.Year
    Month = $shiftedUtc.Month
    Day = $shiftedUtc.Day
  }
}

function Get-BrasiliaDayKey {
  param([datetime]$ReferenceDate = (Get-Date))

  $parts = Get-BrasiliaDateParts $ReferenceDate
  return "{0}-{1}-{2}" -f $parts.Year, $parts.Month.ToString("00"), $parts.Day.ToString("00")
}

function Get-NextBrasiliaMidnightEpoch {
  param([datetime]$ReferenceDate = (Get-Date))

  $parts = Get-BrasiliaDateParts $ReferenceDate
  $nextUtc = [datetime]::SpecifyKind(
    [datetime]::new($parts.Year, $parts.Month, $parts.Day, 3, 0, 0, [DateTimeKind]::Utc),
    [DateTimeKind]::Utc
  ).AddDays(1)
  return [int64]([DateTimeOffset]$nextUtc).ToUnixTimeMilliseconds()
}

function Get-DayNumber {
  param([string]$DayKey)

  $parts = $DayKey.Split("-") | ForEach-Object { [int]$_ }
  $dateUtc = [datetime]::SpecifyKind(
    [datetime]::new($parts[0], $parts[1], $parts[2], 0, 0, 0, [DateTimeKind]::Utc),
    [DateTimeKind]::Utc
  )
  return [math]::Floor(([DateTimeOffset]$dateUtc).ToUnixTimeMilliseconds() / 86400000)
}

$script:answerWords = @(
  (Get-Content (Join-Path $dataRoot "answer-words.json") -Raw -Encoding UTF8 | ConvertFrom-Json) |
    ForEach-Object { [string]$_ }
)
$script:acceptedWords = @(
  (Get-Content (Join-Path $dataRoot "accepted-words.json") -Raw -Encoding UTF8 | ConvertFrom-Json) |
    ForEach-Object { [string]$_ }
)
$script:acceptedSet = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::Ordinal)
foreach ($word in $script:acceptedWords) {
  [void]$script:acceptedSet.Add([string]$word)
}

function Get-DailyChallenge {
  param([datetime]$ReferenceDate = (Get-Date))

  $availableDaysPerSeason = [math]::Floor($script:answerWords.Length / 7)
  $dayKey = Get-BrasiliaDayKey $ReferenceDate
  $absoluteDay = Get-DayNumber $dayKey
  $season = [math]::Floor($absoluteDay / $availableDaysPerSeason)
  $dayInSeason = $absoluteDay % $availableDaysPerSeason
  $seasonPool = Shuffle-WithSeed $script:answerWords "season:$season"
  $offset = $dayInSeason * 7
  $selectedWords = $seasonPool[$offset..($offset + 6)]

  return @{
    dayKey = $dayKey
    serverNowEpochMs = [int64][DateTimeOffset]::Now.ToUnixTimeMilliseconds()
    nextChangeEpochMs = Get-NextBrasiliaMidnightEpoch $ReferenceDate
    termo = @($selectedWords[0])
    dueto = @($selectedWords[1], $selectedWords[2])
    quarteto = @($selectedWords[3], $selectedWords[4], $selectedWords[5], $selectedWords[6])
  }
}

function Get-ContentType {
  param([string]$FilePath)

  switch ([IO.Path]::GetExtension($FilePath).ToLowerInvariant()) {
    ".html" { return "text/html; charset=utf-8" }
    ".js" { return "application/javascript; charset=utf-8" }
    ".css" { return "text/css; charset=utf-8" }
    ".json" { return "application/json; charset=utf-8" }
    ".svg" { return "image/svg+xml" }
    ".png" { return "image/png" }
    ".jpg" { return "image/jpeg" }
    ".jpeg" { return "image/jpeg" }
    ".ico" { return "image/x-icon" }
    default { return "application/octet-stream" }
  }
}

function Get-ReasonPhrase {
  param([int]$StatusCode)

  switch ($StatusCode) {
    200 { return "OK" }
    403 { return "Forbidden" }
    404 { return "Not Found" }
    405 { return "Method Not Allowed" }
    500 { return "Internal Server Error" }
    default { return "OK" }
  }
}

function Write-HttpResponse {
  param(
    [System.Net.Sockets.NetworkStream]$Stream,
    [byte[]]$BodyBytes,
    [string]$ContentType,
    [int]$StatusCode = 200
  )

  $writer = New-Object System.IO.StreamWriter($Stream, [Text.Encoding]::ASCII, 1024, $true)
  $writer.NewLine = "`r`n"
  $writer.WriteLine("HTTP/1.1 $StatusCode $(Get-ReasonPhrase $StatusCode)")
  $writer.WriteLine("Content-Type: $ContentType")
  $writer.WriteLine("Content-Length: $($BodyBytes.Length)")
  $writer.WriteLine("Connection: close")
  $writer.WriteLine("Cache-Control: no-store")
  $writer.WriteLine("")
  $writer.Flush()

  if ($BodyBytes.Length -gt 0) {
    $Stream.Write($BodyBytes, 0, $BodyBytes.Length)
    $Stream.Flush()
  }
}

function Write-JsonResponse {
  param(
    [System.Net.Sockets.NetworkStream]$Stream,
    [hashtable]$Payload,
    [int]$StatusCode = 200
  )

  $bytes = [Text.Encoding]::UTF8.GetBytes(($Payload | ConvertTo-Json -Compress -Depth 8))
  Write-HttpResponse $Stream $bytes "application/json; charset=utf-8" $StatusCode
}

function Write-FileResponse {
  param(
    [System.Net.Sockets.NetworkStream]$Stream,
    [string]$FilePath
  )

  $bytes = [IO.File]::ReadAllBytes($FilePath)
  Write-HttpResponse $Stream $bytes (Get-ContentType $FilePath) 200
}

function Parse-QueryString {
  param([string]$Query)

  $result = @{}

  if ([string]::IsNullOrWhiteSpace($Query)) {
    return $result
  }

  foreach ($pair in $Query.TrimStart("?").Split("&")) {
    if ([string]::IsNullOrWhiteSpace($pair)) {
      continue
    }

    $parts = $pair.Split("=", 2)
    $key = [Uri]::UnescapeDataString($parts[0])
    $value = if ($parts.Length -gt 1) { [Uri]::UnescapeDataString($parts[1]) } else { "" }
    $result[$key] = $value
  }

  return $result
}

function Handle-Request {
  param(
    [string]$Method,
    [string]$RawTarget,
    [System.Net.Sockets.NetworkStream]$Stream
  )

  if ($Method -ne "GET") {
    Write-JsonResponse $Stream @{ error = "method_not_allowed" } 405
    return
  }

  $uri = [Uri]::new("http://localhost:$Port$RawTarget")
  $path = $uri.AbsolutePath
  $query = Parse-QueryString $uri.Query

  if ($path -eq "/api/daily-challenge") {
    Write-JsonResponse $Stream (Get-DailyChallenge)
    return
  }

  if ($path -eq "/api/validate-word") {
    $guess = Normalize-Word $query["guess"]
    Write-JsonResponse $Stream @{
      guess = $guess
      valid = ($guess.Length -eq 5 -and $script:acceptedSet.Contains($guess))
    }
    return
  }

  if ($path -eq "/jogos/termo" -or $path -eq "/jogos/termo/") {
    $writer = New-Object System.IO.StreamWriter($Stream, [Text.Encoding]::ASCII, 1024, $true)
    $writer.NewLine = "`r`n"
    $writer.WriteLine("HTTP/1.1 301 Moved Permanently")
    $writer.WriteLine("Location: /jogos/palavro/")
    $writer.WriteLine("Content-Type: text/plain; charset=utf-8")
    $writer.WriteLine("Content-Length: 0")
    $writer.WriteLine("Connection: close")
    $writer.WriteLine("Cache-Control: no-store")
    $writer.WriteLine("")
    $writer.Flush()
    return
  }

  $relativePath = if ($path -eq "/") { "index.html" } else { $path.TrimStart("/") }
  $relativePath = $relativePath -replace "/", "\"
  $targetPath = Join-Path $projectRoot $relativePath
  $fullPath = [IO.Path]::GetFullPath($targetPath)

  if (-not $fullPath.StartsWith($projectRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    Write-JsonResponse $Stream @{ error = "forbidden" } 403
    return
  }

  if ([IO.Directory]::Exists($fullPath)) {
    $indexPath = Join-Path $fullPath "index.html"

    if ([IO.File]::Exists($indexPath)) {
      Write-FileResponse $Stream $indexPath
      return
    }
  }

  if ([IO.File]::Exists($fullPath)) {
    Write-FileResponse $Stream $fullPath
    return
  }

  Write-JsonResponse $Stream @{ error = "not_found" } 404
}

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
$listener.Start()

Write-Host ""
Write-Host "Servidor do portal iniciado."
Write-Host "Abra: http://localhost:$Port"
Write-Host "Pressione Ctrl+C para encerrar."
Write-Host ""

try {
  while ($true) {
    $client = $listener.AcceptTcpClient()

    try {
      $stream = $client.GetStream()
      $reader = New-Object System.IO.StreamReader($stream, [Text.Encoding]::ASCII, $false, 1024, $true)
      $requestLine = $reader.ReadLine()

      if ([string]::IsNullOrWhiteSpace($requestLine)) {
        $client.Close()
        continue
      }

      while (($line = $reader.ReadLine()) -ne $null -and $line.Length -gt 0) {
      }

      $parts = $requestLine.Split(" ")

      if ($parts.Length -lt 2) {
        Write-JsonResponse $stream @{ error = "bad_request" } 500
      } else {
        Handle-Request $parts[0] $parts[1] $stream
      }
    } catch {
      try {
        if ($stream) {
          Write-JsonResponse $stream @{
            error = "server_error"
            message = $_.Exception.Message
          } 500
        }
      } catch {
      }
    } finally {
      if ($reader) { $reader.Dispose() }
      if ($stream) { $stream.Dispose() }
      $client.Close()
      $reader = $null
      $stream = $null
    }
  }
} finally {
  $listener.Stop()
}
