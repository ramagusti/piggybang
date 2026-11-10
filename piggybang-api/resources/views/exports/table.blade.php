<!doctype html>
<html><head><meta charset="utf-8"><title>{{ $title }}</title>
<style>
body{font-family:DejaVu Sans,sans-serif;font-size:10px;color:#1E1B4B}
h1{font-size:16px;color:#4F46E5;margin:0 0 4px}
p{color:#6B7280;margin:0 0 12px}
table{width:100%;border-collapse:collapse}
th{background:#EEF2FF;text-align:left;padding:5px}
td{padding:5px;border-bottom:1px solid #FDE68A}
td.num{text-align:right}
</style></head>
<body>
<h1>{{ $title }}</h1>
<p>{{ $subtitle }}</p>
<table>
<thead><tr>@foreach($headers as $h)<th>{{ $h }}</th>@endforeach</tr></thead>
<tbody>
@foreach($rows as $row)
<tr>@foreach($row as $i => $cell)<td class="{{ in_array($i, $numeric) ? 'num' : '' }}">{{ $cell }}</td>@endforeach</tr>
@endforeach
</tbody>
</table>
</body></html>
