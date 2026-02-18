import * as vscode from 'vscode';
import * as path from 'path';
import { JTLParser } from './JTLParser';

export class ResultsViewerProvider {
  private static readonly viewType = 'jmeter.resultsViewer';
  private parser: JTLParser;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.parser = new JTLParser();
  }

  public async openResults(resultsPath: string): Promise<void> {
    const panel = vscode.window.createWebviewPanel(
      ResultsViewerProvider.viewType,
      `Results: ${path.basename(resultsPath)}`,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    const samples = this.parser.parseFile(resultsPath);
    const aggregateStats = this.parser.calculateAggregateStats(samples);
    const timeSeriesData = this.parser.getTimeSeriesData(samples, 1000);
    const p50 = this.parser.calculatePercentile(samples, 50);
    const p75 = this.parser.calculatePercentile(samples, 75);
    const p90 = this.parser.calculatePercentile(samples, 90);
    const p95 = this.parser.calculatePercentile(samples, 95);
    const p99 = this.parser.calculatePercentile(samples, 99);

    panel.webview.html = this.getHtmlForWebview(panel.webview, {
      samples: samples.slice(0, 500),
      aggregateStats,
      timeSeriesData,
      percentiles: { p50, p75, p90, p95, p99 },
      resultsPath,
      totalSamples: samples.length
    });
  }

  private getHtmlForWebview(webview: vscode.Webview, data: any): string {
    const totalSamples = data.totalSamples;
    const successCount = data.samples.filter((s: any) => s.success).length;
    const errorCount = data.samples.filter((s: any) => !s.success).length;
    const errorSamples = data.samples.filter((s: any) => !s.success);
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>JMeter Results</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-zoom@2.0.1/dist/chartjs-plugin-zoom.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: var(--vscode-foreground); background-color: var(--vscode-editor-background); padding: 20px; }
    .header { margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid var(--vscode-panel-border); }
    h1 { font-size: 28px; font-weight: 700; margin-bottom: 10px; background: linear-gradient(135deg, var(--vscode-foreground) 0%, #0e639c 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .summary-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 30px; }
    .card { background: linear-gradient(135deg, rgba(14, 99, 156, 0.1) 0%, rgba(14, 99, 156, 0.05) 100%); border: 1px solid var(--vscode-panel-border); border-radius: 8px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .card-label { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: var(--vscode-descriptionForeground); margin-bottom: 8px; }
    .card-value { font-size: 32px; font-weight: 700; color: var(--vscode-foreground); }
    .card-unit { font-size: 14px; color: var(--vscode-descriptionForeground); margin-left: 4px; }
    .tabs { display: flex; gap: 8px; margin-bottom: 20px; border-bottom: 2px solid var(--vscode-panel-border); flex-wrap: wrap; }
    .tab { padding: 12px 20px; background: transparent; border: none; color: var(--vscode-foreground); cursor: pointer; font-size: 13px; font-weight: 600; border-bottom: 3px solid transparent; transition: all 0.2s; }
    .tab:hover { background: var(--vscode-list-hoverBackground); }
    .tab.active { border-bottom-color: #0e639c; color: #0e639c; }
    .tab-content { display: none; }
    .tab-content.active { display: block; }
    .chart-container { background: var(--vscode-editor-background); border: 1px solid var(--vscode-panel-border); border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .chart-title { font-size: 16px; font-weight: 600; margin-bottom: 16px; color: var(--vscode-foreground); }
    canvas { max-height: 300px; }
    table { width: 100%; border-collapse: collapse; background: var(--vscode-editor-background); border: 1px solid var(--vscode-panel-border); border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    th { background: linear-gradient(135deg, rgba(14, 99, 156, 0.2) 0%, rgba(14, 99, 156, 0.1) 100%); padding: 12px; text-align: left; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--vscode-foreground); border-bottom: 2px solid var(--vscode-panel-border); }
    td { padding: 12px; border-bottom: 1px solid var(--vscode-panel-border); font-size: 13px; }
    tr:hover { background: var(--vscode-list-hoverBackground); }
    .success { color: #28a745; font-weight: 600; }
    .error { color: #dc3545; font-weight: 600; }
    .filter-bar { display: flex; gap: 12px; margin-bottom: 20px; padding: 16px; background: var(--vscode-editor-background); border: 1px solid var(--vscode-panel-border); border-radius: 8px; flex-wrap: wrap; }
    input[type="text"] { flex: 1; min-width: 200px; padding: 8px 12px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 4px; font-size: 13px; }
    select { padding: 8px 12px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 4px; font-size: 13px; cursor: pointer; }
    button { padding: 8px 16px; background: linear-gradient(135deg, #0e639c 0%, #0a4d7a 100%); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; transition: all 0.2s; box-shadow: 0 2px 6px rgba(0,0,0,0.2); }
    button:hover { background: linear-gradient(135deg, #1177bb 0%, #0e639c 100%); box-shadow: 0 4px 12px rgba(0,0,0,0.3); transform: translateY(-2px); }
    .sample-detail { background: var(--vscode-editor-background); border: 1px solid var(--vscode-panel-border); border-radius: 8px; padding: 16px; margin-top: 12px; display: none; }
    .sample-detail.show { display: block; }
    .detail-section { margin-bottom: 16px; }
    .detail-label { font-weight: 600; color: var(--vscode-descriptionForeground); margin-bottom: 4px; font-size: 12px; text-transform: uppercase; }
    .detail-value { font-family: 'Courier New', monospace; font-size: 12px; background: rgba(14, 99, 156, 0.1); padding: 8px; border-radius: 4px; white-space: pre-wrap; word-break: break-all; }
  </style>
</head>
<body>
  <div class="header">
    <h1>📊 Test Results Analysis</h1>
    <p style="color: var(--vscode-descriptionForeground); margin-top: 8px;">${data.resultsPath}</p>
  </div>

  <div class="summary-cards">
    <div class="card"><div class="card-label">Total Samples</div><div class="card-value">${totalSamples}</div></div>
    <div class="card"><div class="card-label">Success Rate</div><div class="card-value">${((successCount/data.samples.length)*100).toFixed(2)}<span class="card-unit">%</span></div></div>
    <div class="card"><div class="card-label">Avg Response Time</div><div class="card-value">${(data.samples.reduce((sum: number, s: any) => sum + s.elapsed, 0) / data.samples.length).toFixed(0)}<span class="card-unit">ms</span></div></div>
    <div class="card"><div class="card-label">90th Percentile</div><div class="card-value">${data.percentiles.p90}<span class="card-unit">ms</span></div></div>
    <div class="card"><div class="card-label">95th Percentile</div><div class="card-value">${data.percentiles.p95}<span class="card-unit">ms</span></div></div>
    <div class="card"><div class="card-label">99th Percentile</div><div class="card-value">${data.percentiles.p99}<span class="card-unit">ms</span></div></div>
  </div>

  <div class="tabs">
    <button class="tab active" onclick="showTab('charts')">📈 Charts</button>
    <button class="tab" onclick="showTab('summary')">📊 Summary</button>
    <button class="tab" onclick="showTab('aggregate')">📋 Aggregate</button>
    <button class="tab" onclick="showTab('errors')">❌ Errors (${errorCount})</button>
    <button class="tab" onclick="showTab('tree')">🌳 Results Tree</button>
  </div>

  <div id="charts" class="tab-content active">
    <div class="chart-container"><div class="chart-title">Response Time Over Time (Drag to pan)</div><canvas id="responseTimeChart"></canvas></div>
    <div class="chart-container"><div class="chart-title">Throughput Over Time</div><canvas id="throughputChart"></canvas></div>
    <div class="chart-container"><div class="chart-title">Active Threads Over Time</div><canvas id="threadsChart"></canvas></div>
    <div class="chart-container"><div class="chart-title">Response Time Distribution</div><canvas id="histogramChart"></canvas></div>
    <div class="chart-container"><div class="chart-title">Error Rate Over Time</div><canvas id="errorRateChart"></canvas></div>
    <div class="chart-container"><div class="chart-title">Percentiles</div><canvas id="percentilesChart"></canvas></div>
  </div>

  <div id="summary" class="tab-content">
    <table>
      <thead><tr><th>Metric</th><th>Value</th></tr></thead>
      <tbody>
        <tr><td><strong>Total Samples</strong></td><td>${totalSamples}</td></tr>
        <tr><td><strong>Success</strong></td><td class="success">${successCount} (${((successCount/data.samples.length)*100).toFixed(2)}%)</td></tr>
        <tr><td><strong>Errors</strong></td><td class="error">${errorCount} (${((errorCount/data.samples.length)*100).toFixed(2)}%)</td></tr>
        <tr><td><strong>Average Response Time</strong></td><td>${(data.samples.reduce((sum: number, s: any) => sum + s.elapsed, 0) / data.samples.length).toFixed(0)} ms</td></tr>
        <tr><td><strong>Min Response Time</strong></td><td>${Math.min(...data.samples.map((s: any) => s.elapsed))} ms</td></tr>
        <tr><td><strong>Max Response Time</strong></td><td>${Math.max(...data.samples.map((s: any) => s.elapsed))} ms</td></tr>
        <tr><td><strong>50th Percentile</strong></td><td>${data.percentiles.p50} ms</td></tr>
        <tr><td><strong>75th Percentile</strong></td><td>${data.percentiles.p75} ms</td></tr>
        <tr><td><strong>90th Percentile</strong></td><td>${data.percentiles.p90} ms</td></tr>
        <tr><td><strong>95th Percentile</strong></td><td>${data.percentiles.p95} ms</td></tr>
        <tr><td><strong>99th Percentile</strong></td><td>${data.percentiles.p99} ms</td></tr>
      </tbody>
    </table>
  </div>

  <div id="aggregate" class="tab-content">
    <div class="filter-bar"><button onclick="exportAggregate()">💾 Export to CSV</button><button onclick="exportHTML()">📄 Export to HTML</button></div>
    <table>
      <thead><tr><th>Label</th><th>Samples</th><th>Average (ms)</th><th>Min (ms)</th><th>Max (ms)</th><th>Std Dev</th><th>Error %</th><th>Throughput/s</th></tr></thead>
      <tbody>${data.aggregateStats.map((stat: any) => `<tr><td><strong>${stat.label}</strong></td><td>${stat.samples}</td><td>${stat.average.toFixed(0)}</td><td>${stat.min}</td><td>${stat.max}</td><td>${stat.stdDev.toFixed(2)}</td><td class="${stat.errorRate > 0 ? 'error' : 'success'}">${stat.errorRate.toFixed(2)}%</td><td>${stat.throughput.toFixed(2)}</td></tr>`).join('')}</tbody>
    </table>
  </div>

  <div id="errors" class="tab-content">
    <div class="filter-bar"><input type="text" id="errorSearchInput" placeholder="🔍 Search errors..." onkeyup="filterErrors()"><button onclick="exportErrors()">💾 Export Errors</button></div>
    ${errorCount === 0 ? '<p style="text-align: center; padding: 40px; color: var(--vscode-descriptionForeground);">✅ No errors found!</p>' : `<table id="errorsTable"><thead><tr><th>Timestamp</th><th>Label</th><th>Response Code</th><th>Response Message</th><th>Response Time (ms)</th></tr></thead><tbody>${errorSamples.map((sample: any) => `<tr class="error-row" data-label="${sample.label}"><td>${new Date(sample.timestamp).toLocaleString()}</td><td><strong>${sample.label}</strong></td><td class="error">${sample.responseCode}</td><td>${sample.responseMessage}</td><td>${sample.elapsed}</td></tr>`).join('')}</tbody></table>`}
  </div>

  <div id="tree" class="tab-content">
    <div class="filter-bar"><input type="text" id="treeSearchInput" placeholder="🔍 Search samples..." onkeyup="filterTree()"><select id="treeStatusFilter" onchange="filterTree()"><option value="all">All Status</option><option value="success">Success Only</option><option value="error">Errors Only</option></select></div>
    <table id="treeTable">
      <thead><tr><th>Timestamp</th><th>Label</th><th>Response Time (ms)</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>${data.samples.map((sample: any, idx: number) => `<tr class="tree-row" data-label="${sample.label}" data-success="${sample.success}"><td>${new Date(sample.timestamp).toLocaleTimeString()}</td><td><strong>${sample.label}</strong></td><td>${sample.elapsed}</td><td class="${sample.success ? 'success' : 'error'}">${sample.success ? '✓ Success' : '✗ Failed'}</td><td><button onclick="toggleDetail(${idx})">View Details</button></td></tr><tr id="detail-${idx}" class="sample-detail"><td colspan="5"><div class="detail-section"><div class="detail-label">📤 Request Info</div><div class="detail-value">Name: ${sample.label}
Method: ${sample.method || 'N/A'}
Thread: ${sample.threadName}
Timestamp: ${new Date(sample.timestamp).toLocaleString()}</div></div><div class="detail-section"><div class="detail-label">📥 Response Info</div><div class="detail-value">Code: ${sample.responseCode}
Message: ${sample.responseMessage}
Time: ${sample.elapsed}ms
Latency: ${sample.latency}ms
Connect: ${sample.connect}ms</div></div><div class="detail-section"><div class="detail-label">📊 Data Transfer</div><div class="detail-value">Bytes Received: ${sample.bytes}
Bytes Sent: ${sample.sentBytes}</div></div><div class="detail-section"><div class="detail-label">🧵 Thread Info</div><div class="detail-value">Active Threads: ${sample.allThreads}
Group Threads: ${sample.grpThreads}</div></div></td></tr>`).join('')}</tbody>
    </table>
    ${data.samples.length < totalSamples ? `<p style="margin-top: 16px; color: var(--vscode-descriptionForeground);">Showing first 500 of ${totalSamples} samples for performance</p>` : ''}
  </div>

  <script>
    const timeSeriesData = ${JSON.stringify(data.timeSeriesData)};
    const allSamples = ${JSON.stringify(data.samples)};
    const aggregateStats = ${JSON.stringify(data.aggregateStats)};
    Chart.defaults.color = getComputedStyle(document.body).getPropertyValue('--vscode-foreground');
    Chart.defaults.borderColor = getComputedStyle(document.body).getPropertyValue('--vscode-panel-border');
    const zoomOptions = { zoom: { wheel: { enabled: false }, pinch: { enabled: true }, mode: 'x' }, pan: { enabled: true, mode: 'x' } };
    
    new Chart(document.getElementById('responseTimeChart'), { type: 'line', data: { labels: timeSeriesData.map(d => (d.time / 1000).toFixed(0) + 's'), datasets: [{ label: 'Avg Response Time (ms)', data: timeSeriesData.map(d => d.avgResponseTime), borderColor: '#0e639c', backgroundColor: 'rgba(14, 99, 156, 0.1)', tension: 0.4, fill: true }] }, options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: true }, zoom: zoomOptions }, onClick: (e, items) => { if (items.length > 0) { const idx = items[0].index; alert('Time: ' + timeSeriesData[idx].time/1000 + 's\\nAvg Response: ' + timeSeriesData[idx].avgResponseTime.toFixed(2) + 'ms\\nThroughput: ' + timeSeriesData[idx].throughput); } } } });
    new Chart(document.getElementById('throughputChart'), { type: 'bar', data: { labels: timeSeriesData.map(d => (d.time / 1000).toFixed(0) + 's'), datasets: [{ label: 'Throughput (samples/s)', data: timeSeriesData.map(d => d.throughput), backgroundColor: '#16825d' }] }, options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: true }, zoom: zoomOptions } } });
    new Chart(document.getElementById('threadsChart'), { type: 'line', data: { labels: timeSeriesData.map(d => (d.time / 1000).toFixed(0) + 's'), datasets: [{ label: 'Active Threads', data: timeSeriesData.map(d => d.activeThreads), borderColor: '#c27d0e', backgroundColor: 'rgba(194, 125, 14, 0.1)', tension: 0.4, fill: true }] }, options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: true }, zoom: zoomOptions } } });
    
    const responseTimes = allSamples.map(s => s.elapsed);
    const histogram = {};
    const bucketSize = 100;
    responseTimes.forEach(t => { const bucket = Math.floor(t / bucketSize) * bucketSize; histogram[bucket] = (histogram[bucket] || 0) + 1; });
    new Chart(document.getElementById('histogramChart'), { type: 'bar', data: { labels: Object.keys(histogram).sort((a,b) => a-b).map(k => k + '-' + (parseInt(k) + bucketSize) + 'ms'), datasets: [{ label: 'Sample Count', data: Object.keys(histogram).sort((a,b) => a-b).map(k => histogram[k]), backgroundColor: '#8e44ad' }] }, options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: true } } } });
    new Chart(document.getElementById('errorRateChart'), { type: 'line', data: { labels: timeSeriesData.map(d => (d.time / 1000).toFixed(0) + 's'), datasets: [{ label: 'Errors', data: timeSeriesData.map(d => d.errors), borderColor: '#dc3545', backgroundColor: 'rgba(220, 53, 69, 0.1)', tension: 0.4, fill: true }] }, options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: true }, zoom: zoomOptions } } });
    new Chart(document.getElementById('percentilesChart'), { type: 'bar', data: { labels: ['50th', '75th', '90th', '95th', '99th'], datasets: [{ label: 'Response Time (ms)', data: [${data.percentiles.p50}, ${data.percentiles.p75}, ${data.percentiles.p90}, ${data.percentiles.p95}, ${data.percentiles.p99}], backgroundColor: ['#0e639c', '#16825d', '#c27d0e', '#8e44ad', '#dc3545'] }] }, options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } } } });
    
    function showTab(tabName) { document.querySelectorAll('.tab').forEach(t => t.classList.remove('active')); document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active')); event.target.classList.add('active'); document.getElementById(tabName).classList.add('active'); }
    function filterErrors() { const search = document.getElementById('errorSearchInput').value.toLowerCase(); document.querySelectorAll('.error-row').forEach(row => { row.style.display = row.dataset.label.toLowerCase().includes(search) ? '' : 'none'; }); }
    function filterTree() { const search = document.getElementById('treeSearchInput').value.toLowerCase(); const status = document.getElementById('treeStatusFilter').value; document.querySelectorAll('.tree-row').forEach(row => { const label = row.dataset.label.toLowerCase(); const success = row.dataset.success === 'true'; const matchesSearch = label.includes(search); const matchesStatus = status === 'all' || (status === 'success' && success) || (status === 'error' && !success); row.style.display = matchesSearch && matchesStatus ? '' : 'none'; }); }
    function toggleDetail(idx) { document.getElementById('detail-' + idx).classList.toggle('show'); }
    function exportAggregate() { let csv = 'Label,Samples,Average,Min,Max,Std Dev,Error %,Throughput\\n'; aggregateStats.forEach(stat => { csv += stat.label + ',' + stat.samples + ',' + stat.average.toFixed(0) + ',' + stat.min + ',' + stat.max + ',' + stat.stdDev.toFixed(2) + ',' + stat.errorRate.toFixed(2) + ',' + stat.throughput.toFixed(2) + '\\n'; }); downloadFile('aggregate-report.csv', csv); }
    function exportErrors() { const errors = allSamples.filter(s => !s.success); let csv = 'Timestamp,Label,Response Code,Response Message,Response Time\\n'; errors.forEach(e => { csv += new Date(e.timestamp).toISOString() + ',' + e.label + ',' + e.responseCode + ',' + e.responseMessage + ',' + e.elapsed + '\\n'; }); downloadFile('errors.csv', csv); }
    function exportHTML() { downloadFile('results-report.html', document.documentElement.outerHTML); }
    function downloadFile(filename, content) { const blob = new Blob([content], { type: 'text/plain' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url); }
  </script>
</body>
</html>`;
  }
}
