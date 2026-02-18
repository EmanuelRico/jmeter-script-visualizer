import * as vscode from 'vscode';
import { createHTTPSampler, createThreadGroup, createRegexExtractor, createResponseAssertion } from '../model/types';

export function registerCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('jmeter.addThreadGroup', async () => {
      const name = await vscode.window.showInputBox({
        prompt: 'Enter thread group name',
        value: 'Thread Group'
      });
      
      if (name) {
        const threadGroup = createThreadGroup(name);
        vscode.window.showInformationMessage(`Created thread group: ${name}`);
        // TODO: Add to current test plan
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('jmeter.addHTTPSampler', async () => {
      const name = await vscode.window.showInputBox({
        prompt: 'Enter HTTP sampler name',
        value: 'HTTP Request'
      });
      
      if (name) {
        const sampler = createHTTPSampler(name);
        vscode.window.showInformationMessage(`Created HTTP sampler: ${name}`);
        // TODO: Add to selected element
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('jmeter.addRegexExtractor', async () => {
      const name = await vscode.window.showInputBox({
        prompt: 'Enter extractor name',
        value: 'Regular Expression Extractor'
      });
      
      const refName = await vscode.window.showInputBox({
        prompt: 'Enter reference name (variable name)',
        value: 'myVar'
      });
      
      if (name && refName) {
        const extractor = createRegexExtractor(name, refName);
        vscode.window.showInformationMessage(`Created regex extractor: ${name}`);
        // TODO: Add to selected sampler
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('jmeter.addAssertion', async () => {
      const name = await vscode.window.showInputBox({
        prompt: 'Enter assertion name',
        value: 'Response Assertion'
      });
      
      if (name) {
        const assertion = createResponseAssertion(name);
        vscode.window.showInformationMessage(`Created assertion: ${name}`);
        // TODO: Add to selected sampler
      }
    })
  );
}
