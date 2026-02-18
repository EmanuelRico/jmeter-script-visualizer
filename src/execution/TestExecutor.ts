import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { spawn, ChildProcess } from 'child_process';

export interface TestExecutionOptions {
  testPlanPath: string;
  resultsPath?: string;
  logPath?: string;
  properties?: Record<string, string>;
  remoteServers?: string[];
  threadGroups?: string[];
}

export interface TestExecutionResult {
  success: boolean;
  resultsPath: string;
  logPath: string;
  duration: number;
  totalSamples?: number;
  errors?: number;
  error?: string;
}

export interface TestProgress {
  activeThreads: number;
  totalSamples: number;
  errors: number;
  avgResponseTime: number;
  throughput: number;
}

export class TestExecutor {
  private jmeterPath: string | null = null;
  private currentProcess: ChildProcess | null = null;
  private outputChannel: vscode.OutputChannel;
  private recentResults: TestExecutionResult[] = [];
  private progressCallback?: (progress: TestProgress) => void;

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel('JMeter Test Execution');
    this.loadRecentResults();
  }

  async findJMeterPath(): Promise<string | null> {
    if (this.jmeterPath) {
      return this.jmeterPath;
    }

    const config = vscode.workspace.getConfiguration('jmeter');
    const configuredPath = config.get<string>('jmeterPath');
    
    if (configuredPath && fs.existsSync(configuredPath)) {
      this.jmeterPath = configuredPath;
      return this.jmeterPath;
    }

    // Check PATH first
    try {
      const { execSync } = require('child_process');
      const result = execSync('which jmeter', { encoding: 'utf-8' }).trim();
      if (result && fs.existsSync(result)) {
        this.jmeterPath = result;
        return this.jmeterPath;
      }
    } catch (error) {
      // which command failed, continue to other checks
    }

    const jmeterHome = process.env.JMETER_HOME;
    if (jmeterHome) {
      const binPath = path.join(jmeterHome, 'bin', 'jmeter');
      if (fs.existsSync(binPath) || fs.existsSync(binPath + '.bat')) {
        this.jmeterPath = binPath;
        return this.jmeterPath;
      }
    }

    const commonPaths = [
      '/usr/local/bin/jmeter',
      '/opt/homebrew/bin/jmeter',
      '/opt/jmeter/bin/jmeter',
      'C:\\Program Files\\apache-jmeter\\bin\\jmeter.bat',
      'C:\\jmeter\\bin\\jmeter.bat'
    ];

    for (const p of commonPaths) {
      if (fs.existsSync(p)) {
        this.jmeterPath = p;
        return this.jmeterPath;
      }
    }

    return null;
  }

  async executeTest(options: TestExecutionOptions, progressCallback?: (progress: TestProgress) => void): Promise<TestExecutionResult> {
    const startTime = Date.now();
    this.progressCallback = progressCallback;
    
    const jmeterPath = await this.findJMeterPath();
    if (!jmeterPath) {
      throw new Error('JMeter not found. Please install JMeter and set JMETER_HOME or configure jmeter.jmeterPath in settings.');
    }

    const logsDir = path.join(path.dirname(options.testPlanPath), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    const resultsPath = options.resultsPath || path.join(
      logsDir,
      `results-${Date.now()}.jtl`
    );

    const logPath = options.logPath || path.join(
      logsDir,
      `jmeter-${Date.now()}.log`
    );

    const args = [
      '-n',
      '-t', options.testPlanPath,
      '-l', resultsPath,
      '-j', logPath,
      '-Jjmeter.save.saveservice.output_format=xml',
      '-Jjmeter.save.saveservice.response_data=true',
      '-Jjmeter.save.saveservice.samplerData=true',
      '-Jjmeter.save.saveservice.requestHeaders=true',
      '-Jjmeter.save.saveservice.responseHeaders=true',
      '-Jjmeter.save.saveservice.assertion_results_failure_message=true'
    ];

    if (options.threadGroups && options.threadGroups.length > 0) {
      args.push('-JthreadGroupNames=' + options.threadGroups.join(','));
    }

    if (options.properties) {
      for (const [key, value] of Object.entries(options.properties)) {
        args.push('-J' + key + '=' + value);
      }
    }

    if (options.remoteServers && options.remoteServers.length > 0) {
      args.push('-r');
      args.push('-R', options.remoteServers.join(','));
    }

    this.outputChannel.clear();
    this.outputChannel.show();
    this.outputChannel.appendLine(`🚀 Starting JMeter test execution...`);
    this.outputChannel.appendLine(`📍 JMeter: ${jmeterPath}`);
    this.outputChannel.appendLine(`📄 Test Plan: ${options.testPlanPath}`);
    this.outputChannel.appendLine(`💾 Results: ${resultsPath}`);
    this.outputChannel.appendLine(`📝 Command: ${jmeterPath} ${args.join(' ')}\n`);
    this.outputChannel.appendLine('─'.repeat(80) + '\n');

    let jtlWatcher: fs.FSWatcher | null = null;
    const progress: TestProgress = {
      activeThreads: 0,
      totalSamples: 0,
      errors: 0,
      avgResponseTime: 0,
      throughput: 0
    };

    return new Promise((resolve, reject) => {
      this.currentProcess = spawn(jmeterPath, args, {
        cwd: path.dirname(options.testPlanPath)
      });

      setTimeout(() => {
        if (fs.existsSync(resultsPath)) {
          jtlWatcher = fs.watch(resultsPath, () => {
            this.parseJTLProgress(resultsPath, progress, startTime);
          });
        }
      }, 1000);

      this.currentProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        this.outputChannel.append(output);
        
        // Parse and display detailed sampler results
        if (output.includes('sample_count') || output.includes('elapsed')) {
          this.parseSamplerOutput(output);
        }
      });

      this.currentProcess.stderr?.on('data', (data) => {
        this.outputChannel.append(data.toString());
      });

      this.currentProcess.on('close', (code) => {
        const duration = Date.now() - startTime;
        this.currentProcess = null;
        
        if (jtlWatcher) {
          jtlWatcher.close();
        }

        const finalStats = this.parseJTLFinal(resultsPath);
        
        // Display detailed results
        this.displayDetailedResults(resultsPath);

        if (code === 0) {
          this.outputChannel.appendLine('\n' + '─'.repeat(80));
          this.outputChannel.appendLine(`\n✅ Test completed successfully in ${(duration / 1000).toFixed(2)}s`);
          this.outputChannel.appendLine(`📊 Total Samples: ${finalStats.totalSamples}`);
          this.outputChannel.appendLine(`❌ Errors: ${finalStats.errors}`);
          this.outputChannel.appendLine(`📈 Success Rate: ${((1 - finalStats.errors / finalStats.totalSamples) * 100).toFixed(2)}%`);
          
          const result: TestExecutionResult = {
            success: true,
            resultsPath,
            logPath,
            duration,
            totalSamples: finalStats.totalSamples,
            errors: finalStats.errors
          };
          
          this.addRecentResult(result);
          resolve(result);
        } else {
          const error = `Test execution failed with exit code ${code}`;
          this.outputChannel.appendLine(`\n❌ ${error}`);
          reject(new Error(error));
        }
      });

      this.currentProcess.on('error', (error) => {
        this.currentProcess = null;
        if (jtlWatcher) {
          jtlWatcher.close();
        }
        this.outputChannel.appendLine(`\n❌ Error: ${error.message}`);
        reject(error);
      });
    });
  }

  private parseSamplerOutput(output: string): void {
    // Extract sampler information from JMeter output
    const lines = output.split('\n');
    for (const line of lines) {
      if (line.includes('summary')) {
        this.outputChannel.appendLine('\n📊 ' + line);
      }
    }
  }

  private displayDetailedResults(resultsPath: string): void {
    try {
      if (!fs.existsSync(resultsPath)) return;
      
      const content = fs.readFileSync(resultsPath, 'utf-8');
      
      // Parse XML results
      if (content.includes('<?xml')) {
        this.parseXMLResults(content);
      } else {
        // CSV format - show last few samples
        const lines = content.split('\n').filter(l => l.trim());
        const lastSamples = lines.slice(-5);
        
        this.outputChannel.appendLine('\n' + '═'.repeat(80));
        this.outputChannel.appendLine('📋 LAST 5 SAMPLES DETAILS');
        this.outputChannel.appendLine('═'.repeat(80) + '\n');
        
        lastSamples.forEach((line, idx) => {
          const parts = line.split(',');
          if (parts.length > 10) {
            this.outputChannel.appendLine(`\n🔹 Sample ${idx + 1}: ${parts[2]}`);
            this.outputChannel.appendLine(`   ⏱️  Response Time: ${parts[1]}ms`);
            this.outputChannel.appendLine(`   📡 Response Code: ${parts[3]}`);
            this.outputChannel.appendLine(`   ${parts[7] === 'true' ? '✅' : '❌'} Status: ${parts[7] === 'true' ? 'Success' : 'Failed'}`);
            this.outputChannel.appendLine(`   📊 Bytes: ${parts[9]}`);
            this.outputChannel.appendLine(`   🧵 Thread: ${parts[5]}`);
          }
        });
      }
    } catch (error) {
      // Ignore parsing errors
    }
  }

  private parseXMLResults(content: string): void {
    try {
      const xml2js = require('xml2js');
      xml2js.parseString(content, { explicitArray: false, mergeAttrs: true }, (err: any, result: any) => {
        if (err || !result) return;
        
        let samples = result.testResults?.httpSample || result.testResults?.sample;
        if (!samples) return;
        
        const sampleArray = Array.isArray(samples) ? samples : [samples];
        const lastSamples = sampleArray.slice(-5);
        
        this.outputChannel.appendLine('\n' + '═'.repeat(80));
        this.outputChannel.appendLine('📋 DETAILED SAMPLE RESULTS');
        this.outputChannel.appendLine('═'.repeat(80));
        
        lastSamples.forEach((sample: any, idx: number) => {
          this.outputChannel.appendLine(`\n${'▬'.repeat(80)}`);
          this.outputChannel.appendLine(`🔹 Sample ${idx + 1}: ${sample.lb || sample.label || 'Unknown'}`);
          this.outputChannel.appendLine(`${'▬'.repeat(80)}`);
          
          // Request Info
          this.outputChannel.appendLine('\n📤 REQUEST:');
          let method = 'GET';
          if (sample.requestHeader && typeof sample.requestHeader === 'string') {
            const firstLine = sample.requestHeader.split('\n')[0];
            const match = firstLine.match(/(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)/);
            if (match) method = match[1];
          }
          this.outputChannel.appendLine(`   Name: ${sample.lb || sample.label || 'N/A'}`);
          this.outputChannel.appendLine(`   Method: ${method}`);
          this.outputChannel.appendLine(`   Thread: ${sample.tn || 'N/A'}`);
          
          if (sample.requestHeader && typeof sample.requestHeader === 'string') {
            this.outputChannel.appendLine('\n   📨 Request Headers:');
            const headerLines = sample.requestHeader.split('\n');
            headerLines.filter((h: string) => h.trim()).forEach((h: string) => this.outputChannel.appendLine(`      ${h.trim()}`));
          }
          
          if (sample.queryString && typeof sample.queryString === 'string') {
            const preview = sample.queryString.length > 300 ? sample.queryString.substring(0, 300) + '...' : sample.queryString;
            this.outputChannel.appendLine(`\n   📝 Request Body:\n      ${preview}`);
          }
          
          // Response Info
          this.outputChannel.appendLine('\n📥 RESPONSE:');
          const success = sample.s === 'true' || sample.success === 'true';
          this.outputChannel.appendLine(`   ${success ? '✅' : '❌'} Status: ${success ? 'Success' : 'Failed'}`);
          this.outputChannel.appendLine(`   📡 Response Code: ${sample.rc || 'N/A'}`);
          this.outputChannel.appendLine(`   ⏱️  Response Time: ${sample.t || sample.elapsed || 'N/A'}ms`);
          this.outputChannel.appendLine(`   📊 Bytes: ${sample.by || sample.bytes || 'N/A'}`);
          this.outputChannel.appendLine(`   ⚡ Latency: ${sample.lt || sample.latency || 'N/A'}ms`);
          
          if (sample.responseHeader && typeof sample.responseHeader === 'string') {
            this.outputChannel.appendLine('\n   📨 Response Headers:');
            const headers = sample.responseHeader.split('\n').filter((h: string) => h.trim());
            headers.slice(0, 10).forEach((h: string) => this.outputChannel.appendLine(`      ${h.trim()}`));
            if (headers.length > 10) {
              this.outputChannel.appendLine(`      ... and ${headers.length - 10} more headers`);
            }
          }
          
          if (sample.responseData) {
            const responseData = typeof sample.responseData === 'string' ? sample.responseData : JSON.stringify(sample.responseData);
            const preview = responseData.length > 500 ? responseData.substring(0, 500) + '\n      ... (truncated, total ' + responseData.length + ' chars)' : responseData;
            this.outputChannel.appendLine(`\n   📄 Response Body:\n      ${preview}`);
          }
          
          if (sample.responseMessage || sample.rm) {
            this.outputChannel.appendLine(`\n   💬 Response Message: ${sample.responseMessage || sample.rm}`);
          }
        });
        
        this.outputChannel.appendLine('\n' + '═'.repeat(80) + '\n');
      });
    } catch (error) {
      this.outputChannel.appendLine(`\n⚠️  Could not parse detailed results: ${error}`);
    }
  }

  private parseJTLProgress(filePath: string, progress: TestProgress, startTime: number): void {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('<?xml'));
      
      if (lines.length < 2) return;

      const samples = lines.slice(1).filter(l => l.includes(','));
      progress.totalSamples = samples.length;
      progress.errors = samples.filter(l => l.split(',')[7] === 'false').length;
      
      const responseTimes = samples.map(l => parseInt(l.split(',')[1]) || 0);
      progress.avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length || 0;
      
      const elapsed = (Date.now() - startTime) / 1000;
      progress.throughput = progress.totalSamples / elapsed;

      if (this.progressCallback) {
        this.progressCallback(progress);
      }
    } catch (error) {
      // Ignore parsing errors during execution
    }
  }

  private parseJTLFinal(filePath: string): { totalSamples: number; errors: number } {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      
      if (content.includes('<?xml')) {
        const xml2js = require('xml2js');
        let result = { totalSamples: 0, errors: 0 };
        xml2js.parseString(content, { explicitArray: false, mergeAttrs: true }, (err: any, parsed: any) => {
          if (err || !parsed) return;
          let samples = parsed.testResults?.httpSample || parsed.testResults?.sample;
          if (!samples) return;
          const sampleArray = Array.isArray(samples) ? samples : [samples];
          result.totalSamples = sampleArray.length;
          result.errors = sampleArray.filter((s: any) => s.s === 'false' || s.success === 'false').length;
        });
        return result;
      }
      
      const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('<?xml'));
      if (lines.length < 2) return { totalSamples: 0, errors: 0 };
      const samples = lines.slice(1).filter(l => l.includes(','));
      const totalSamples = samples.length;
      const errors = samples.filter(l => l.split(',')[7] === 'false').length;
      return { totalSamples, errors };
    } catch (error) {
      return { totalSamples: 0, errors: 0 };
    }
  }

  private addRecentResult(result: TestExecutionResult): void {
    this.recentResults.unshift(result);
    if (this.recentResults.length > 10) {
      this.recentResults = this.recentResults.slice(0, 10);
    }
    this.saveRecentResults();
  }

  private saveRecentResults(): void {
    try {
      const storePath = path.join(process.env.HOME || process.env.USERPROFILE || '', '.jmeter-vscode-results.json');
      fs.writeFileSync(storePath, JSON.stringify(this.recentResults, null, 2));
    } catch (error) {
      // Ignore save errors
    }
  }

  private loadRecentResults(): void {
    try {
      const storePath = path.join(process.env.HOME || process.env.USERPROFILE || '', '.jmeter-vscode-results.json');
      if (fs.existsSync(storePath)) {
        this.recentResults = JSON.parse(fs.readFileSync(storePath, 'utf-8'));
      }
    } catch (error) {
      this.recentResults = [];
    }
  }

  getRecentResults(): TestExecutionResult[] {
    return this.recentResults.filter(r => fs.existsSync(r.resultsPath));
  }

  stopTest(): void {
    if (this.currentProcess) {
      this.outputChannel.appendLine('\n⏹️ Stopping test execution...');
      this.currentProcess.kill('SIGTERM');
      this.currentProcess = null;
    }
  }

  isRunning(): boolean {
    return this.currentProcess !== null;
  }

  dispose(): void {
    this.stopTest();
    this.outputChannel.dispose();
  }
}
