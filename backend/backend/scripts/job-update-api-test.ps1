param(
  [Parameter(Mandatory = $true)]
  [string]$JobId,

  [Parameter(Mandatory = $true)]
  [string]$Token
)

function Call-JobUpdate {
  param(
    [Parameter(Mandatory = $true)]
    [string]$jobId,

    [Parameter(Mandatory = $true)]
    [string]$token,

    [Parameter(Mandatory = $true)]
    [hashtable]$body
  )

  $headers = @{
    Authorization = "Bearer $token"
    "Content-Type" = "application/json"
  }

  $jsonBody = $body | ConvertTo-Json -Depth 5

  try {
    $response = Invoke-RestMethod `
      -Method PUT `
      -Uri "http://localhost:5000/api/v1/jobs/$jobId" `
      -Headers $headers `
      -Body $jsonBody

    [pscustomobject]@{
      Status = "SUCCESS"
      StatusCode = 200
      Body = $response
    }
  }
  catch {
    $statusCode = 0
    if ($_.Exception.Response) {
      $statusCode = [int]$_.Exception.Response.StatusCode
    }

    $errorBody = $null
    if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
      try {
        $errorBody = $_.ErrorDetails.Message | ConvertFrom-Json
      }
      catch {
        $errorBody = $_.ErrorDetails.Message
      }
    }

    [pscustomobject]@{
      Status = "ERROR"
      StatusCode = $statusCode
      Body = $errorBody
    }
  }
}

Write-Output "Running JOB-3 refinement API tests with reusable Call-JobUpdate function"

Write-Output "Case 1: Valid update (expected 200)"
$result1 = Call-JobUpdate -jobId $JobId -token $Token -body @{
  title = "Updated Title"
}
$result1 | ConvertTo-Json -Depth 10

Write-Output "Case 2: Only restricted fields (expected 400)"
$result2 = Call-JobUpdate -jobId $JobId -token $Token -body @{
  id = "hack"
}
$result2 | ConvertTo-Json -Depth 10

Write-Output "Case 3: Invalid salary case (expected 400 when salary_min is already higher)"
$result3 = Call-JobUpdate -jobId $JobId -token $Token -body @{
  salary_max = 1000
}
$result3 | ConvertTo-Json -Depth 10

Write-Output "Case 4: Invalid skills (expected 422)"
$result4 = Call-JobUpdate -jobId $JobId -token $Token -body @{
  skills = @("Node", "")
}
$result4 | ConvertTo-Json -Depth 10

Write-Output "Case 5: Type normalization test (expected 200, stored as remote)"
$result5 = Call-JobUpdate -jobId $JobId -token $Token -body @{
  type = "Remote"
}
$result5 | ConvertTo-Json -Depth 10

$headers = @{
  Authorization = "Bearer $Token"
}
$jobSnapshot = Invoke-RestMethod -Method GET -Uri "http://localhost:5000/api/v1/jobs/$JobId" -Headers $headers

Write-Output "Final job snapshot"
$jobSnapshot | ConvertTo-Json -Depth 10
