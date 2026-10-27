param([string]$Path, [string]$BuildsJson, [string]$OutJson)
$cells = @('E10','A18','C18','E21','E45','E46','E47','E48','C53','E54','C58','C59','C62','C63','C64','C67','C68','C69','C72','C73','C76','C77','C80','E80','C81','C102','C103','C104','C105','C106','C107','E107','C108','E108','C109','E109','C110','E110','C111','C112','C113','C115','C116')
$builds = Get-Content -Raw $BuildsJson | ConvertFrom-Json
$tmp = Join-Path $env:TEMP ("fc_batch_" + [guid]::NewGuid().ToString() + ".xlsx")
Copy-Item -LiteralPath $Path $tmp
$xl = New-Object -ComObject Excel.Application
$xl.Visible = $false; $xl.DisplayAlerts = $false; $xl.ScreenUpdating = $false
$results = @()
try {
  $wb = $xl.Workbooks.Open($tmp)
  $ws = $wb.Worksheets.Item('DPS Calculator')
  foreach ($b in $builds) {
    foreach ($p in $b.PSObject.Properties) { $name = [string]$p.Name; $v = $p.Value; if ($v -is [string]) { $ws.Range($name).Value2 = [string]$v } else { $ws.Range($name).Value2 = [double]$v } }
    $xl.Calculate()
    $row = [ordered]@{}
    foreach ($c in $cells) {
      $v = $ws.Range($c).Value2
      if ($v -is [double]) { $row[$c] = $v } else { $row[$c] = "ERR:" + $ws.Range($c).Text }
    }
    $results += ,$row
  }
  ConvertTo-Json -InputObject $results -Depth 4 | Set-Content -Encoding utf8 $OutJson
  $wb.Close($false)
} finally { $xl.Quit(); [System.Runtime.Interopservices.Marshal]::ReleaseComObject($xl) | Out-Null; Remove-Item $tmp -ErrorAction SilentlyContinue }
