import * as fs from 'fs';

export interface SampleResult {
  timestamp: number;
  elapsed: number;
  label: string;
  responseCode: string;
  responseMessage: string;
  threadName: string;
  success: boolean;
  bytes: number;
  sentBytes: number;
  grpThreads: number;
  allThreads: number;
  latency: number;
  idleTime: number;
  connect: number;
}

export interface AggregateStats {
  label: string;
  samples: number;
  average: number;
  min: number;
  max: number;
  stdDev: number;
  errorRate: number;
  throughput: number;
  receivedKB: number;
  sentKB: number;
  avgBytes: number;
}

export class JTLParser {
  parseFile(filePath: string): SampleResult[] {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    if (content.includes('<?xml')) {
      return this.parseXML(content);
    }
    
    const lines = content.split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',');
    const samples: SampleResult[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      if (values.length < headers.length) continue;

      samples.push({
        timestamp: parseInt(values[0]) || 0,
        elapsed: parseInt(values[1]) || 0,
        label: values[2] || '',
        responseCode: values[3] || '',
        responseMessage: values[4] || '',
        threadName: values[5] || '',
        success: values[7] === 'true',
        bytes: parseInt(values[9]) || 0,
        sentBytes: parseInt(values[10]) || 0,
        grpThreads: parseInt(values[11]) || 0,
        allThreads: parseInt(values[12]) || 0,
        latency: parseInt(values[13]) || 0,
        idleTime: parseInt(values[14]) || 0,
        connect: parseInt(values[15]) || 0
      });
    }

    return samples;
  }

  private parseXML(content: string): SampleResult[] {
    const xml2js = require('xml2js');
    const samples: SampleResult[] = [];
    
    xml2js.parseString(content, { explicitArray: false, mergeAttrs: true }, (err: any, result: any) => {
      if (err || !result) return;
      
      let sampleData = result.testResults?.httpSample || result.testResults?.sample;
      if (!sampleData) return;
      
      const sampleArray = Array.isArray(sampleData) ? sampleData : [sampleData];
      
      sampleArray.forEach((s: any) => {
        let method = 'GET';
        
        if (s.requestHeader && typeof s.requestHeader === 'string') {
          const firstLine = s.requestHeader.split('\n')[0];
          const match = firstLine.match(/(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)/);
          if (match) {
            method = match[1];
          }
        }
        
        samples.push({
          timestamp: parseInt(s.ts) || 0,
          elapsed: parseInt(s.t || s.elapsed) || 0,
          label: s.lb || s.label || '',
          responseCode: s.rc || '',
          responseMessage: s.rm || s.responseMessage || '',
          threadName: s.tn || '',
          success: s.s === 'true' || s.success === 'true',
          bytes: parseInt(s.by || s.bytes) || 0,
          sentBytes: parseInt(s.sby) || 0,
          grpThreads: parseInt(s.ng) || 0,
          allThreads: parseInt(s.na) || 0,
          latency: parseInt(s.lt || s.latency) || 0,
          idleTime: parseInt(s.it) || 0,
          connect: parseInt(s.ct) || 0,
          method
        } as any);
      });
    });
    
    return samples;
  }

  calculateAggregateStats(samples: SampleResult[]): AggregateStats[] {
    const grouped = new Map<string, SampleResult[]>();
    
    samples.forEach(s => {
      if (!grouped.has(s.label)) {
        grouped.set(s.label, []);
      }
      grouped.get(s.label)!.push(s);
    });

    const stats: AggregateStats[] = [];
    
    grouped.forEach((samples, label) => {
      const elapsed = samples.map(s => s.elapsed);
      const errors = samples.filter(s => !s.success).length;
      const totalBytes = samples.reduce((sum, s) => sum + s.bytes, 0);
      const totalSentBytes = samples.reduce((sum, s) => sum + s.sentBytes, 0);
      
      const avg = elapsed.reduce((a, b) => a + b, 0) / elapsed.length;
      const variance = elapsed.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / elapsed.length;
      const stdDev = Math.sqrt(variance);
      
      const duration = (Math.max(...samples.map(s => s.timestamp)) - Math.min(...samples.map(s => s.timestamp))) / 1000;
      const throughput = duration > 0 ? samples.length / duration : 0;

      stats.push({
        label,
        samples: samples.length,
        average: avg,
        min: Math.min(...elapsed),
        max: Math.max(...elapsed),
        stdDev,
        errorRate: (errors / samples.length) * 100,
        throughput,
        receivedKB: totalBytes / 1024,
        sentKB: totalSentBytes / 1024,
        avgBytes: totalBytes / samples.length
      });
    });

    return stats;
  }

  calculatePercentile(samples: SampleResult[], percentile: number): number {
    const sorted = samples.map(s => s.elapsed).sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index] || 0;
  }

  getTimeSeriesData(samples: SampleResult[], intervalMs: number = 1000): Array<{time: number, avgResponseTime: number, throughput: number, errors: number, activeThreads: number}> {
    if (samples.length === 0) return [];

    const minTime = Math.min(...samples.map(s => s.timestamp));
    const maxTime = Math.max(...samples.map(s => s.timestamp));
    const intervals: Array<{time: number, avgResponseTime: number, throughput: number, errors: number, activeThreads: number}> = [];

    for (let time = minTime; time <= maxTime; time += intervalMs) {
      const intervalSamples = samples.filter(s => s.timestamp >= time && s.timestamp < time + intervalMs);
      
      if (intervalSamples.length > 0) {
        const avgResponseTime = intervalSamples.reduce((sum, s) => sum + s.elapsed, 0) / intervalSamples.length;
        const errors = intervalSamples.filter(s => !s.success).length;
        const maxThreads = Math.max(...intervalSamples.map(s => s.allThreads));
        
        intervals.push({
          time: time - minTime,
          avgResponseTime,
          throughput: intervalSamples.length,
          errors,
          activeThreads: maxThreads
        });
      }
    }

    return intervals;
  }
}
