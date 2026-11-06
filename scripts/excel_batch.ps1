param([string]$Path, [string]$BuildsJson, [string]$OutJson)
$cells = @('E10','A18','C18','E21','E72','E73','E74','E75','C81','E82','C87','C88','C91','C92','C93','C96','C97','C98','C101','C102','C105','C106','C109','E109','C110','C131','C132','C133','C134','C135','C136','E136','C137','E137','C138','E138','C139','E139','C141','C142','C143','C145','C146')
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
