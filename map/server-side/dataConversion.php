<?php
/*
 * Convert a CSV table into the data.json format read by the map templates.
 *
 * Usage: php dataConversion.php [input.csv] [data.json] [delimiter]
 *        (defaults: input.csv, out.json, ",")
 *
 * The first column is the region id (ISO country code, state code or county
 * FIPS code, matching the ids in js/worldmap.js etc.); its header is ignored.
 * Every other column becomes a field, named by its header. Include a "label"
 * column for the name shown in the information pane and tooltip.
 *
 *   id,label,total,male,female
 *   BR,Brazil,88.6,88.4,88.8
 *
 * becomes (region ids at the top level, numbers as JSON numbers):
 *
 *   {"BR": {"label": "Brazil", "total": 88.6, "male": 88.4, "female": 88.8}}
 *
 * Quoted fields may contain the delimiter. Empty cells are left out.
 */

$inputFile = $argv[1] ?? 'input.csv';
$outputFile = $argv[2] ?? 'out.json';
$delimiter = $argv[3] ?? ',';

$input = fopen($inputFile, 'r');
if ($input === false) {
    fwrite(STDERR, "Cannot open $inputFile\n");
    exit(1);
}

$header = fgetcsv($input, 0, $delimiter, '"', '');
if ($header === false || count($header) < 2) {
    fwrite(STDERR, "$inputFile needs a header row with an id column and at least one field\n");
    exit(1);
}
$header = array_map('trim', $header);
$header[0] = preg_replace('/^\xEF\xBB\xBF/', '', $header[0]); // strip a UTF-8 BOM

$data = [];
while (($row = fgetcsv($input, 0, $delimiter, '"', '')) !== false) {
    if ($row === [null] || trim((string) $row[0]) === '') continue; // blank line or no id
    $id = trim($row[0]);
    $fields = [];
    for ($i = 1; $i < count($header); $i++) {
        $value = isset($row[$i]) ? trim($row[$i]) : '';
        if ($value === '') continue;
        $fields[$header[$i]] = is_numeric($value) ? $value + 0 : $value;
    }
    $data[$id] = $fields;
}
fclose($input);

$json = json_encode((object) $data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
if ($json === false || file_put_contents($outputFile, $json . "\n") === false) {
    fwrite(STDERR, "Cannot write $outputFile\n");
    exit(1);
}
echo 'Wrote ' . count($data) . " regions to $outputFile\n";
