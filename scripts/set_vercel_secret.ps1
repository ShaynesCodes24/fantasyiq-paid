param(
  [Parameter(Mandatory = $true)]
  [string]$Name,

  [ValidateSet("production", "preview", "development")]
  [string]$Target = "production"
)

$ErrorActionPreference = "Stop"

if ($Name -notmatch '^[A-Z0-9_]+$') {
  throw "Secret name must be uppercase letters, numbers, and underscores only."
}

$secure = Read-Host "Paste value for $Name ($Target). Input is hidden" -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
  $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
}

if ([string]::IsNullOrWhiteSpace($plain)) {
  throw "No value provided for $Name."
}

Write-Host "Removing existing $Name from $Target if present..."
vercel env rm $Name $Target --yes 2>$null | Out-Null

Write-Host "Adding $Name to Vercel $Target..."
$plain | vercel env add $Name $Target --yes

if ($LASTEXITCODE -ne 0) {
  throw "Vercel failed to save $Name."
}

Write-Host "$Name saved in Vercel $Target. The value was not written to disk."
