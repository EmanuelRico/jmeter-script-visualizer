import * as vscode from 'vscode';
import { JMeterEditorProvider } from './JMeterEditorProvider';
import { registerCommands } from './commands';
import { TestExecutor } from '../execution/TestExecutor';
import { ResultsViewerProvider } from '../results/ResultsViewerProvider';

let testExecutor: TestExecutor;
let resultsViewer: ResultsViewerProvider;

export function activate(context: vscode.ExtensionContext) {
  console.log('JMeter extension activated');

  testExecutor = new TestExecutor();
  resultsViewer = new ResultsViewerProvider(context);
  context.subscriptions.push(testExecutor);

  const provider = new JMeterEditorProvider(context);
  
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      'jmeter.testPlanEditor',
      provider,
      {
        webviewOptions: {
          retainContextWhenHidden: true
        },
        supportsMultipleEditorsPerDocument: false
      }
    )
  );

  registerCommands(context);

  context.subscriptions.push(
    vscode.commands.registerCommand('jmeter.openVisualEditor', async (uri: vscode.Uri) => {
      await vscode.commands.executeCommand('vscode.openWith', uri, 'jmeter.testPlanEditor');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('jmeter.runTest', async (uri?: vscode.Uri) => {
      const testPlanPath = uri?.fsPath || vscode.window.activeTextEditor?.document.uri.fsPath;
      
      if (!testPlanPath || !testPlanPath.endsWith('.jmx')) {
        vscode.window.showErrorMessage('Please open or select a .jmx test plan file');
        return;
      }

      if (testExecutor.isRunning()) {
        vscode.window.showWarningMessage('A test is already running. Stop it first.');
        return;
      }

      try {
        await vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: 'Running JMeter Test',
          cancellable: true
        }, async (progress, token) => {
          token.onCancellationRequested(() => {
            testExecutor.stopTest();
          });

          let lastUpdate = Date.now();
          progress.report({ message: 'Starting test execution...' });
          
          const result = await testExecutor.executeTest(
            { testPlanPath },
            (testProgress) => {
              const now = Date.now();
              if (now - lastUpdate > 1000) {
                progress.report({ 
                  message: `Samples: ${testProgress.totalSamples} | Errors: ${testProgress.errors} | Throughput: ${testProgress.throughput.toFixed(2)}/s`,
                  increment: 1
                });
                lastUpdate = now;
              }
            }
          );

          const successRate = ((1 - (result.errors || 0) / (result.totalSamples || 1)) * 100).toFixed(2);
          vscode.window.showInformationMessage(
            `✅ Test completed in ${(result.duration / 1000).toFixed(2)}s | Samples: ${result.totalSamples} | Success: ${successRate}%`,
            'View Results',
            'Open Log',
            'View Charts'
          ).then(action => {
            if (action === 'View Results') {
              vscode.commands.executeCommand('vscode.open', vscode.Uri.file(result.resultsPath));
            } else if (action === 'Open Log') {
              vscode.commands.executeCommand('vscode.open', vscode.Uri.file(result.logPath));
            } else if (action === 'View Charts') {
              resultsViewer.openResults(result.resultsPath);
            }
          });
        });
      } catch (error: any) {
        vscode.window.showErrorMessage(`Test execution failed: ${error.message}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('jmeter.stopTest', () => {
      if (testExecutor.isRunning()) {
        testExecutor.stopTest();
        vscode.window.showInformationMessage('Test execution stopped');
      } else {
        vscode.window.showInformationMessage('No test is currently running');
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('jmeter.viewRecentResults', async () => {
      const results = testExecutor.getRecentResults();
      
      if (results.length === 0) {
        vscode.window.showInformationMessage('No recent test results found');
        return;
      }

      const items = results.map(r => ({
        label: `$(clock) ${new Date(r.duration).toLocaleString()}`,
        description: `Samples: ${r.totalSamples} | Errors: ${r.errors} | Duration: ${(r.duration / 1000).toFixed(2)}s`,
        detail: r.resultsPath,
        result: r
      }));

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a test result to view'
      });

      if (selected) {
        const action = await vscode.window.showQuickPick(
          ['View Charts', 'View Results File', 'View Log File', 'Open in Finder/Explorer'],
          { placeHolder: 'What would you like to do?' }
        );

        if (action === 'View Results File') {
          vscode.commands.executeCommand('vscode.open', vscode.Uri.file(selected.result.resultsPath));
        } else if (action === 'View Log File') {
          vscode.commands.executeCommand('vscode.open', vscode.Uri.file(selected.result.logPath));
        } else if (action === 'Open in Finder/Explorer') {
          vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(selected.result.resultsPath));
        } else if (action === 'View Charts') {
          resultsViewer.openResults(selected.result.resultsPath);
        }
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('jmeter.viewResultsChart', async (uri?: vscode.Uri) => {
      let resultsPath = uri?.fsPath;
      
      if (!resultsPath) {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        const defaultUri = workspaceFolders ? vscode.Uri.file(workspaceFolders[0].uri.fsPath + '/logs') : undefined;
        
        const fileUri = await vscode.window.showOpenDialog({
          canSelectFiles: true,
          canSelectFolders: false,
          canSelectMany: false,
          filters: { 'JTL Files': ['jtl', 'csv'] },
          title: 'Select JMeter Results File',
          defaultUri
        });
        
        if (fileUri && fileUri[0]) {
          resultsPath = fileUri[0].fsPath;
        }
      }
      
      if (resultsPath) {
        resultsViewer.openResults(resultsPath);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('jmeter.configureJMeterPath', async () => {
      const path = await vscode.window.showInputBox({
        prompt: 'Enter the path to JMeter executable (e.g., /usr/local/bin/jmeter)',
        placeHolder: '/path/to/jmeter'
      });

      if (path) {
        await vscode.workspace.getConfiguration('jmeter').update('jmeterPath', path, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage('JMeter path configured successfully');
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('jmeter.explainTestPlan', async () => {
      vscode.window.showInformationMessage('AI Explanation feature coming soon!');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('jmeter.analyzeTestPlan', async () => {
      vscode.window.showInformationMessage('AI Analysis feature coming soon!');
    })
  );
}

export function deactivate() {
  console.log('JMeter extension deactivated');
}
