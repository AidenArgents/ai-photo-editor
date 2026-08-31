Add-Type -AssemblyName System.Drawing

function T([int[]]$codes) {
    return (-join ($codes | ForEach-Object { [char]$_ }))
}

$output = Join-Path (Get-Location) 'out\order-summary-2026-08-30.png'
$bitmap = New-Object System.Drawing.Bitmap(1280, 760)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$graphics.Clear([System.Drawing.Color]::White)

$title = T @(0x80E4,0x5143,0x7AD9,0x70B9,0x8BA2,0x5355,0x65E5,0x5747,0x7EDF,0x8BA1,0xFF08,0x6700,0x65B0,0x6570,0x636E,0xFF09)
$country = T @(0x56FD,0x5BB6,0x7AD9,0x70B9)
$until = T @(0x622A,0x81F3)
$recent = T @(0x6700,0x8FD1)
$dayavg = T @(0x5929,0x65E5,0x5747)
$headers = @(
    $country,
    ($until + '2026-08-30 ' + $recent + '30' + $dayavg),
    ($until + '2026-08-30 ' + $recent + '7' + $dayavg)
)
$rows = @(
    @( (T @(0x5370,0x5EA6,0x5C3C,0x897F,0x4E9A)), '1,963', '1,907'),
    @( (T @(0x58A8,0x897F,0x54E5)), '43', '46'),
    @( (T @(0x5DF4,0x897F)), '4', '5'),
    @( (T @(0x6CF0,0x56FD)), '130', '136'),
    @( (T @(0x83F2,0x5F8B,0x5BBE)), '1,319', '1,154'),
    @( (T @(0x8D8A,0x5357)), '612', '530'),
    @( (T @(0x9A6C,0x6765,0x897F,0x4E9A)), '307', '585')
)
$previous = @(
    @('1,915','1,823'),
    @('42','45'),
    @('5','2'),
    @('139','132'),
    @('1,242','1,213'),
    @('620','650'),
    @('318','203')
)

$titleFont = New-Object System.Drawing.Font('Microsoft YaHei', 22, [System.Drawing.FontStyle]::Bold)
$headerFont = New-Object System.Drawing.Font('Microsoft YaHei', 17, [System.Drawing.FontStyle]::Bold)
$bodyFont = New-Object System.Drawing.Font('Microsoft YaHei', 20, [System.Drawing.FontStyle]::Regular)
$bodyBoldFont = New-Object System.Drawing.Font('Microsoft YaHei', 20, [System.Drawing.FontStyle]::Bold)
$countryFont = New-Object System.Drawing.Font('Microsoft YaHei', 20, [System.Drawing.FontStyle]::Bold)
$titleBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#1F4E78'))
$headerBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#1F4E78'))
$countryBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#F2F2F2'))
$latestBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#FFF2CC'))
$headerTextBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$bodyTextBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#1F2937'))
$greenTextBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#008000'))
$redTextBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#FF0000'))
$borderPen = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml('#B8C4D1'), 1)
$center = New-Object System.Drawing.StringFormat
$center.Alignment = [System.Drawing.StringAlignment]::Center
$center.LineAlignment = [System.Drawing.StringAlignment]::Center
$left = New-Object System.Drawing.StringFormat
$left.Alignment = [System.Drawing.StringAlignment]::Near
$left.LineAlignment = [System.Drawing.StringAlignment]::Center

$graphics.DrawString($title, $titleFont, $titleBrush, (New-Object System.Drawing.PointF(28, 12)))
$x0 = 20
$y0 = 70
$rowHeight = 86
$widths = @(260, 500, 460)

$x = $x0
for ($c = 0; $c -lt $headers.Count; $c++) {
    $rect = New-Object System.Drawing.RectangleF($x, $y0, $widths[$c], $rowHeight)
    $graphics.FillRectangle($headerBrush, $rect)
    $graphics.DrawRectangle($borderPen, $x, $y0, $widths[$c], $rowHeight)
    $graphics.DrawString($headers[$c], $headerFont, $headerTextBrush, $rect, $center)
    $x += $widths[$c]
}

for ($r = 0; $r -lt $rows.Count; $r++) {
    $y = $y0 + (($r + 1) * $rowHeight)
    $x = $x0
    for ($c = 0; $c -lt $widths.Count; $c++) {
        if ($c -eq 0) {
            $fill = $countryBrush; $font = $countryFont; $format = $left; $textBrush = $bodyTextBrush
        } else {
            $currentValue = [int](($rows[$r][$c] -replace ',', ''))
            $previousValue = [int](($previous[$r][$c - 1] -replace ',', ''))
            $fill = $latestBrush; $format = $center
            if ($currentValue -gt $previousValue) { $font = $bodyBoldFont; $textBrush = $greenTextBrush }
            elseif ($currentValue -lt $previousValue) { $font = $bodyFont; $textBrush = $redTextBrush }
            else { $font = $bodyFont; $textBrush = $bodyTextBrush }
        }
        $rect = New-Object System.Drawing.RectangleF($x, $y, $widths[$c], $rowHeight)
        $graphics.FillRectangle($fill, $rect)
        $graphics.DrawRectangle($borderPen, $x, $y, $widths[$c], $rowHeight)
        $graphics.DrawString($rows[$r][$c], $font, $textBrush, $rect, $format)
        $x += $widths[$c]
    }
}

$bitmap.Save($output, [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose()
$bitmap.Dispose()
Write-Output $output
