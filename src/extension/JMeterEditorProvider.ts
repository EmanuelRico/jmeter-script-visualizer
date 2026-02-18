import * as vscode from 'vscode';
import { JMXParser } from '../parser/JMXParser';
import { JMXSerializer } from '../parser/JMXSerializer';
import { JMeterTestPlan, BaseElement } from '../model/types';

export class JMeterEditorProvider implements vscode.CustomTextEditorProvider {
  private static readonly viewType = 'jmeter.testPlanEditor';
  private parser: JMXParser;
  private serializer: JMXSerializer;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.parser = new JMXParser();
    this.serializer = new JMXSerializer();
  }

  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    webviewPanel.webview.options = {
      enableScripts: true
    };

    webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

    const updateWebview = async () => {
      try {
        const testPlan = await this.parser.parse(document.getText());
        webviewPanel.webview.postMessage({
          type: 'update',
          data: testPlan
        });
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to parse JMX: ${error}`);
      }
    };

    const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
      if (e.document.uri.toString() === document.uri.toString()) {
        updateWebview();
      }
    });

    webviewPanel.onDidDispose(() => {
      changeDocumentSubscription.dispose();
    });

    webviewPanel.webview.onDidReceiveMessage(async e => {
      console.log('Received message:', e.type, e);
      switch (e.type) {
        case 'ready':
          await updateWebview();
          break;
        
        case 'update':
          await this.updateDocument(document, e.data);
          break;
        
        case 'toggleEnabled':
          await this.toggleElementEnabled(document, e.elementId);
          break;
        
        case 'deleteElement':
          await this.deleteElement(document, e.elementId);
          break;
        
        case 'updateProperty':
          await this.updateElementProperty(document, e.elementId, e.property, e.value);
          break;
        
        case 'error':
          vscode.window.showErrorMessage(e.message);
          break;
      }
    });

    await updateWebview();
  }

  private async toggleElementEnabled(document: vscode.TextDocument, elementId: string): Promise<void> {
    try {
      const testPlan = await this.parser.parse(document.getText());
      const element = this.findElementById([testPlan.testPlan, ...testPlan.testPlan.children], elementId);
      if (element) {
        element.enabled = !element.enabled;
        await this.updateDocument(document, testPlan);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to toggle element: ${error}`);
    }
  }

  private async deleteElement(document: vscode.TextDocument, elementId: string): Promise<void> {
    try {
      const testPlan = await this.parser.parse(document.getText());
      if (this.removeElementById([testPlan.testPlan, ...testPlan.testPlan.children], elementId)) {
        await this.updateDocument(document, testPlan);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to delete element: ${error}`);
    }
  }

  private async updateElementProperty(document: vscode.TextDocument, elementId: string, property: string, value: any): Promise<void> {
    try {
      const testPlan = await this.parser.parse(document.getText());
      const element = this.findElementById([testPlan.testPlan, ...testPlan.testPlan.children], elementId);
      if (element) {
        (element as any)[property] = value;
        await this.updateDocument(document, testPlan);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to update property: ${error}`);
    }
  }

  private findElementById(elements: BaseElement[], id: string): BaseElement | null {
    for (const element of elements) {
      if (element.id === id) {
        return element;
      }
      if (element.children) {
        const found = this.findElementById(element.children, id);
        if (found) return found;
      }
    }
    return null;
  }

  private removeElementById(elements: BaseElement[], id: string): boolean {
    for (let i = 0; i < elements.length; i++) {
      if (elements[i].id === id) {
        elements.splice(i, 1);
        return true;
      }
      if (elements[i].children) {
        if (this.removeElementById(elements[i].children, id)) {
          return true;
        }
      }
    }
    return false;
  }

  private async updateDocument(document: vscode.TextDocument, testPlan: JMeterTestPlan): Promise<void> {
    try {
      const xml = this.serializer.serialize(testPlan);
      const edit = new vscode.WorkspaceEdit();
      const fullRange = new vscode.Range(
        document.positionAt(0),
        document.positionAt(document.getText().length)
      );
      edit.replace(document.uri, fullRange, xml);
      await vscode.workspace.applyEdit(edit);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to update document: ${error}`);
    }
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>JMeter Test Plan Editor</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      display: flex;
      height: 100vh;
      overflow: hidden;
    }
    
    .sidebar {
      flex: 0 0 350px;
      display: flex;
      flex-direction: column;
      border-right: 1px solid var(--vscode-panel-border);
      background-color: var(--vscode-sideBar-background);
    }
    
    .sidebar.fullwidth {
      flex: 1;
    }
    
    .main-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    
    .toolbar {
      padding: 16px;
      border-bottom: 1px solid var(--vscode-panel-border);
      display: flex;
      gap: 12px;
      align-items: center;
      background: linear-gradient(180deg, var(--vscode-editorGroupHeader-tabsBackground) 0%, var(--vscode-sideBar-background) 100%);
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    
    .add-element-bar {
      padding: 12px 16px;
      border-bottom: 1px solid var(--vscode-panel-border);
      display: flex;
      gap: 8px;
      align-items: center;
      background-color: var(--vscode-sideBar-background);
    }
    
    .graph-container {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      overflow: auto;
      padding: 20px;
      background: linear-gradient(135deg, #1e1e1e 0%, #2d2d30 100%);
      z-index: 10;
    }
    
    .graph-node {
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .graph-node:hover rect {
      filter: brightness(1.2);
    }
    
    .graph-node rect {
      fill: #0e639c;
      stroke: #1177bb;
      stroke-width: 2;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
    }
    
    .graph-node.type-ThreadGroup rect {
      fill: #16825d;
      stroke: #1a9870;
    }
    
    .graph-node.type-HTTPSamplerProxy rect {
      fill: #0e639c;
      stroke: #1177bb;
    }
    
    .graph-node.type-RegexExtractor rect {
      fill: #c27d0e;
      stroke: #d89614;
    }
    
    .graph-node.type-ResponseAssertion rect {
      fill: #8e44ad;
      stroke: #9b59b6;
    }
    
    .graph-node.type-HeaderManager rect {
      fill: #2980b9;
      stroke: #3498db;
    }
    
    .graph-node.disabled rect {
      opacity: 0.3;
    }
    
    .graph-node text {
      fill: #ffffff;
      font-size: 12px;
      font-weight: 500;
      pointer-events: none;
    }
    
    .graph-link {
      fill: none;
      stroke: #3c3c3c;
      stroke-width: 2;
      opacity: 0.6;
    }
    
    .tree-container {
      flex: 1;
      overflow-y: auto;
      padding: 8px;
    }
    
    .property-container {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
    }
    
    .header {
      padding: 20px;
      border-bottom: 2px solid var(--vscode-panel-border);
      background: linear-gradient(180deg, var(--vscode-editorGroupHeader-tabsBackground) 0%, var(--vscode-sideBar-background) 100%);
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    
    h1 {
      font-size: 20px;
      font-weight: 700;
      margin-bottom: 6px;
      letter-spacing: 0.3px;
      background: linear-gradient(135deg, var(--vscode-foreground) 0%, #0e639c 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    
    h2 {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 16px;
      color: var(--vscode-foreground);
    }
    
    .metadata {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .tree-item {
      padding: 10px 12px;
      margin: 3px 0;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      user-select: none;
      transition: all 0.2s ease;
      position: relative;
      border: 1px solid transparent;
    }
    
    .tree-item:hover {
      background-color: var(--vscode-list-hoverBackground);
      border-color: var(--vscode-panel-border);
      box-shadow: 0 2px 6px rgba(0,0,0,0.1);
      transform: translateX(4px);
    }
    
    .tree-item:hover .tree-item-actions {
      opacity: 1;
    }
    
    .tree-item.selected {
      background: linear-gradient(90deg, var(--vscode-list-activeSelectionBackground) 0%, rgba(14, 99, 156, 0.8) 100%);
      color: var(--vscode-list-activeSelectionForeground);
      border-color: var(--vscode-focusBorder);
      box-shadow: 0 3px 10px rgba(14, 99, 156, 0.3);
      font-weight: 600;
    }
    
    .tree-item.disabled {
      opacity: 0.4;
    }
    
    .tree-item.disabled .tree-item-name {
      text-decoration: line-through;
    }
    
    .tree-item-icon {
      font-size: 14px;
      flex-shrink: 0;
      width: 18px;
      text-align: center;
    }
    
    .tree-item-name {
      flex: 1;
      font-size: 13px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .tree-item-type {
      font-size: 10px;
      color: white;
      padding: 3px 8px;
      border-radius: 10px;
      background: linear-gradient(135deg, #0e639c 0%, #0a4d7a 100%);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 600;
      box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    }
    
    .tree-item-type.level-0 {
      background: linear-gradient(135deg, #16825d 0%, #0f5d43 100%);
    }
    
    .tree-item-type.level-1 {
      background: linear-gradient(135deg, #0e639c 0%, #0a4d7a 100%);
    }
    
    .tree-item-type.level-2 {
      background: linear-gradient(135deg, #c27d0e 0%, #8e5a0a 100%);
    }
    
    .tree-item-type.level-3 {
      background: linear-gradient(135deg, #8e44ad 0%, #6c3483 100%);
    }
    
    .tree-item-type.level-4 {
      background: linear-gradient(135deg, #2980b9 0%, #1f5f8b 100%);
    }
    
    .tree-item-actions {
      display: flex;
      gap: 2px;
      opacity: 0;
      transition: opacity 0.1s;
    }
    
    .tree-children {
      margin-left: 20px;
      border-left: 1px solid var(--vscode-panel-border);
      padding-left: 8px;
    }
    
    .loading {
      text-align: center;
      padding: 40px;
      color: var(--vscode-descriptionForeground);
    }
    
    .property-panel {
      background-color: var(--vscode-editor-background);
    }
    
    .property-section {
      margin-bottom: 24px;
    }
    
    .property-section-title {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 2px solid var(--vscode-focusBorder);
      background: linear-gradient(90deg, var(--vscode-focusBorder) 0%, transparent 100%);
      padding-left: 8px;
    }
    
    .property-row {
      display: flex;
      flex-direction: column;
      margin-bottom: 16px;
      gap: 6px;
    }
    
    .property-label {
      font-weight: 500;
      font-size: 12px;
      color: var(--vscode-input-foreground);
      display: flex;
      align-items: center;
      gap: 4px;
    }
    
    .property-help {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      margin-top: 4px;
    }
    
    input, textarea, select {
      width: 100%;
      padding: 10px 14px;
      background-color: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1.5px solid var(--vscode-input-border);
      border-radius: 6px;
      font-family: var(--vscode-font-family);
      font-size: 13px;
      transition: all 0.2s ease;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      line-height: 1.4;
    }
    
    select {
      cursor: pointer;
      appearance: none;
      background-image: url('data:image/svg+xml;utf8,<svg fill="white" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M7 10l5 5 5-5z"/></svg>');
      background-repeat: no-repeat;
      background-position: right 8px center;
      background-size: 20px;
      padding-right: 36px;
    }
    
    input:hover, textarea:hover, select:hover {
      border-color: var(--vscode-focusBorder);
      box-shadow: 0 2px 6px rgba(0,0,0,0.15);
    }
    
    input:focus, textarea:focus, select:focus {
      outline: none;
      border-color: var(--vscode-focusBorder);
      box-shadow: 0 0 0 3px rgba(14, 99, 156, 0.2), 0 2px 8px rgba(0,0,0,0.2);
      transform: translateY(-1px);
    }
    
    input[type="checkbox"] {
      width: auto;
      cursor: pointer;
    }
    
    .input-group {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    
    button {
      padding: 8px 16px;
      background: linear-gradient(135deg, var(--vscode-button-background) 0%, #0a4d7a 100%);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
      transition: all 0.2s ease;
      box-shadow: 0 2px 6px rgba(0,0,0,0.2);
      letter-spacing: 0.3px;
    }
    
    button:hover {
      background: linear-gradient(135deg, var(--vscode-button-hoverBackground) 0%, #0e639c 100%);
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      transform: translateY(-2px);
    }
    
    button:active {
      transform: translateY(0);
      box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    }
    
    .btn-icon {
      padding: 6px 8px;
      font-size: 16px;
      background-color: transparent;
      color: var(--vscode-foreground);
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 28px;
      height: 28px;
      transition: all 0.2s ease;
      box-shadow: none;
    }
    
    .btn-icon:hover {
      background-color: var(--vscode-toolbar-hoverBackground);
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      transform: scale(1.1);
    }
    
    .btn-icon.danger:hover {
      background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
      color: white;
      box-shadow: 0 3px 10px rgba(220, 53, 69, 0.4);
    }
    
    .btn-secondary {
      background: linear-gradient(135deg, var(--vscode-button-secondaryBackground) 0%, #2d2d30 100%);
      color: var(--vscode-button-secondaryForeground);
      border: 1px solid var(--vscode-panel-border);
      box-shadow: 0 2px 4px rgba(0,0,0,0.15);
    }
    
    .btn-secondary:hover {
      background: linear-gradient(135deg, var(--vscode-button-secondaryHoverBackground) 0%, #3e3e42 100%);
      border-color: var(--vscode-focusBorder);
      box-shadow: 0 4px 10px rgba(0,0,0,0.25);
      transform: translateY(-2px);
    }
    
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--vscode-descriptionForeground);
      gap: 12px;
    }
    
    .empty-state-icon {
      font-size: 48px;
      opacity: 0.3;
    }
    
    .empty-state-text {
      font-size: 14px;
    }
    
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 700;
      background: linear-gradient(135deg, var(--vscode-badge-background) 0%, #0a4d7a 100%);
      color: var(--vscode-badge-foreground);
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      letter-spacing: 0.5px;
    }
    
    .badge.success {
      background-color: #28a745;
      color: white;
    }
    
    .badge.warning {
      background-color: #ffc107;
      color: #000;
    }
    
    .badge.error {
      background-color: #dc3545;
      color: white;
    }
  </style>
</head>
<body>
  <div class="sidebar" id="sidebar">
    <div class="header">
      <h1>Test Plan Structure</h1>
      <div class="metadata">JMeter Visual Editor</div>
    </div>
    
    <div class="toolbar">
      <button class="btn-secondary" onclick="collapseAll()" title="Collapse All">⊟ Collapse</button>
      <button class="btn-secondary" onclick="expandAll()" title="Expand All">⊞ Expand</button>
      <button class="btn-secondary" onclick="toggleView()" title="Toggle View">📊 Graph View</button>
    </div>
    
    <div class="add-element-bar">
      <select id="newElementType" style="flex: 1;">
        <option value="">-- Add Element --</option>
        <optgroup label="Thread Groups">
          <option value="ThreadGroup">Thread Group</option>
          <option value="SetupThreadGroup">Setup Thread Group</option>
          <option value="PostThreadGroup">Teardown Thread Group</option>
        </optgroup>
        <optgroup label="Samplers">
          <option value="HTTPSamplerProxy">HTTP Request</option>
          <option value="JSR223Sampler">JSR223 Sampler</option>
        </optgroup>
        <optgroup label="Logic Controllers">
          <option value="IfController">If Controller</option>
          <option value="WhileController">While Controller</option>
          <option value="ForeachController">ForEach Controller</option>
          <option value="TransactionController">Transaction Controller</option>
          <option value="LoopController">Loop Controller</option>
        </optgroup>
        <optgroup label="Config Elements">
          <option value="CSVDataSet">CSV Data Set Config</option>
          <option value="UserDefinedVariables">User Defined Variables</option>
          <option value="HeaderManager">HTTP Header Manager</option>
          <option value="CookieManager">HTTP Cookie Manager</option>
          <option value="CacheManager">HTTP Cache Manager</option>
          <option value="AuthManager">HTTP Authorization Manager</option>
          <option value="Counter">Counter</option>
        </optgroup>
        <optgroup label="Timers">
          <option value="ConstantTimer">Constant Timer</option>
          <option value="UniformRandomTimer">Uniform Random Timer</option>
          <option value="GaussianRandomTimer">Gaussian Random Timer</option>
          <option value="ConstantThroughputTimer">Constant Throughput Timer</option>
        </optgroup>
        <optgroup label="Pre/Post Processors">
          <option value="JSR223PreProcessor">JSR223 PreProcessor</option>
          <option value="JSR223PostProcessor">JSR223 PostProcessor</option>
          <option value="RegexExtractor">Regular Expression Extractor</option>
          <option value="JSONExtractor">JSON Extractor</option>
          <option value="XPathExtractor">XPath Extractor</option>
          <option value="BoundaryExtractor">Boundary Extractor</option>
        </optgroup>
        <optgroup label="Assertions">
          <option value="ResponseAssertion">Response Assertion</option>
          <option value="JSONAssertion">JSON Assertion</option>
          <option value="XPathAssertion">XPath Assertion</option>
          <option value="DurationAssertion">Duration Assertion</option>
          <option value="SizeAssertion">Size Assertion</option>
          <option value="BeanShellAssertion">BeanShell Assertion</option>
        </optgroup>
        <optgroup label="Listeners">
          <option value="ViewResultsTree">View Results Tree</option>
          <option value="SummaryReport">Summary Report</option>
          <option value="AggregateReport">Aggregate Report</option>
          <option value="SimpleDataWriter">Simple Data Writer</option>
          <option value="BackendListener">Backend Listener</option>
        </optgroup>
      </select>
      <button onclick="addElementToSelected()" title="Add to Selected">➕ Add</button>
    </div>
    
    <div class="tree-container" id="tree-container">
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <div class="empty-state-text">Loading test plan...</div>
      </div>
    </div>
  </div>
  
  <div class="graph-container" id="graph-container" style="display: none;">
    <button class="btn-secondary" onclick="toggleView()" style="position: absolute; top: 20px; right: 20px; z-index: 100;">← Back to Tree</button>
    <svg id="graph-svg" width="100%" height="100%"></svg>
  </div>
  
  <div class="main-content" id="main-content">
    <div class="header">
      <h1 id="element-title">Properties</h1>
      <div class="metadata" id="element-subtitle">Select an element to view properties</div>
    </div>
    
    <div class="property-container" id="property-container">
      <div class="empty-state">
        <div class="empty-state-icon">👈</div>
        <div class="empty-state-text">Select an element from the tree</div>
      </div>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    let currentTestPlan = null;
    let selectedElement = null;
    let isGraphView = false;

    window.addEventListener('message', event => {
      const message = event.data;
      
      switch (message.type) {
        case 'update':
          const previousSelectedId = selectedElement ? selectedElement.id : null;
          currentTestPlan = message.data;
          render();
          // Always restore selection after render
          if (previousSelectedId) {
            selectedElement = findElementById(currentTestPlan.testPlan.children, previousSelectedId);
            if (selectedElement) {
              // Don't re-render properties, just update the tree selection
              document.querySelectorAll('.tree-item').forEach(el => el.classList.remove('selected'));
              const selectedDiv = document.querySelector(\`.tree-item[onclick*="'\${previousSelectedId}'"]\`);
              if (selectedDiv) selectedDiv.classList.add('selected');
            }
          }
          break;
      }
    });

    function toggleView() {
      isGraphView = !isGraphView;
      const sidebar = document.getElementById('sidebar');
      const graphContainer = document.getElementById('graph-container');
      const mainContent = document.getElementById('main-content');
      const btn = event.target;
      
      if (isGraphView) {
        sidebar.style.display = 'none';
        graphContainer.style.display = 'block';
        mainContent.style.display = 'none';
        btn.textContent = '📋 Tree View';
        renderGraph();
      } else {
        sidebar.style.display = 'flex';
        graphContainer.style.display = 'none';
        mainContent.style.display = 'flex';
        btn.textContent = '📊 Graph View';
      }
    }
    
    function renderGraph() {
      if (!currentTestPlan) return;
      
      const svg = document.getElementById('graph-svg');
      const container = document.getElementById('graph-container');
      const width = container.clientWidth;
      
      svg.innerHTML = '';
      
      const nodeWidth = 200;
      const nodeHeight = 45;
      const horizontalSpacing = 40;
      const verticalSpacing = 80;
      
      function calculateWidth(element) {
        if (!element.children || element.children.length === 0) {
          return nodeWidth;
        }
        let totalWidth = 0;
        element.children.forEach(child => {
          totalWidth += calculateWidth(child) + horizontalSpacing;
        });
        return Math.max(totalWidth - horizontalSpacing, nodeWidth);
      }
      
      function calculateDepth(element) {
        if (!element.children || element.children.length === 0) {
          return 1;
        }
        let maxDepth = 0;
        element.children.forEach(child => {
          maxDepth = Math.max(maxDepth, calculateDepth(child));
        });
        return maxDepth + 1;
      }
      
      function drawNode(element, x, y, allocatedWidth) {
        const icon = getIconForType(element.type);
        const nodeX = x + (allocatedWidth - nodeWidth) / 2;
        
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('class', 'graph-node type-' + element.type + (element.enabled ? '' : ' disabled'));
        g.onclick = () => selectElement(element.id, null);
        
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', nodeX);
        rect.setAttribute('y', y);
        rect.setAttribute('width', nodeWidth);
        rect.setAttribute('height', nodeHeight);
        rect.setAttribute('rx', 6);
        g.appendChild(rect);
        
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', nodeX + 12);
        text.setAttribute('y', y + 28);
        text.textContent = icon + ' ' + (element.name.length > 23 ? element.name.substring(0, 20) + '...' : element.name);
        g.appendChild(text);
        
        svg.appendChild(g);
        
        if (element.children && element.children.length > 0) {
          const childY = y + nodeHeight + verticalSpacing;
          let childX = x;
          
          element.children.forEach(child => {
            const childWidth = calculateWidth(child);
            const childCenterX = childX + childWidth / 2;
            
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('class', 'graph-link');
            path.setAttribute('d', \`M\${nodeX + nodeWidth/2},\${y + nodeHeight} L\${nodeX + nodeWidth/2},\${y + nodeHeight + verticalSpacing/2} L\${childCenterX},\${y + nodeHeight + verticalSpacing/2} L\${childCenterX},\${childY}\`);
            svg.appendChild(path);
            
            drawNode(child, childX, childY, childWidth);
            childX += childWidth + horizontalSpacing;
          });
        }
      }
      
      const treeWidth = calculateWidth(currentTestPlan.testPlan);
      const treeDepth = calculateDepth(currentTestPlan.testPlan);
      const height = treeDepth * (nodeHeight + verticalSpacing) + 100;
      const startX = (width - treeWidth) / 2;
      
      drawNode(currentTestPlan.testPlan, startX, 50, treeWidth);
      
      svg.setAttribute('width', Math.max(width, treeWidth + 100));
      svg.setAttribute('height', height);
    }

    function render() {
      const treeContainer = document.getElementById('tree-container');
      
      if (!currentTestPlan) {
        treeContainer.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-text">No test plan loaded</div></div>';
        return;
      }

      const testPlan = currentTestPlan.testPlan;
      
      treeContainer.innerHTML = \`
        <div class="tree-item selected" onclick="selectElement(null)">
          <span class="toggle-arrow" data-target="testplan-children" onclick="event.stopPropagation(); toggleChildren('testplan-children', this)" style="cursor:pointer; margin-right:4px;">▼</span>
          <span class="tree-item-icon">📋</span>
          <span class="tree-item-name">\${escapeHtml(testPlan.name)}</span>
          <span class="tree-item-type">Test Plan</span>
        </div>
        <div class="tree-children" id="testplan-children">
          \${renderChildren(testPlan.children)}
        </div>
      \`;
      
      // Don't re-render properties if we have a selected element
      // Properties are already rendered by the message handler
      if (!selectedElement) {
        renderTestPlanProperties();
      }
    }

    function renderChildren(children, level = 0) {
      if (!children || children.length === 0) {
        return '';
      }

      return children.map(child => {
        const icon = getIconForType(child.type);
        const disabledClass = child.enabled ? '' : 'disabled';
        const selectedClass = selectedElement && selectedElement.id === child.id ? 'selected' : '';
        const statusIcon = child.enabled ? '✅' : '❌';
        const statusTitle = child.enabled ? 'Enabled - Click to disable' : 'Disabled - Click to enable';
        const hasChildren = child.children && child.children.length > 0;
        const childId = 'children-' + child.id;
        const levelClass = 'level-' + (level % 5);
        
        return \`
          <div>
            <div class="tree-item \${disabledClass} \${selectedClass}" onclick="selectElement('\${child.id}', event)">
              \${hasChildren ? \`<span class="toggle-arrow" data-target="\${childId}" onclick="event.stopPropagation(); toggleChildren('\${childId}', this)" style="cursor:pointer; margin-right:4px;">▼</span>\` : '<span style="width:14px; display:inline-block;"></span>'}
              <span class="tree-item-icon">\${icon}</span>
              <span class="tree-item-name">\${escapeHtml(child.name)}</span>
              <span class="tree-item-type \${levelClass}">\${getTypeLabel(child.type)}</span>
              <div class="tree-item-actions">
                <button class="btn-icon" onclick="toggleEnabled(event, '\${child.id}')" title="\${statusTitle}">
                  \${statusIcon}
                </button>
                <button class="btn-icon danger" onclick="deleteElement(event, '\${child.id}')" title="Delete element (Cmd+Z to undo)">
                  🗑️
                </button>
              </div>
            </div>
            \${hasChildren ? 
              \`<div class="tree-children" id="\${childId}">\${renderChildren(child.children, level + 1)}</div>\` : 
              ''}
          </div>
        \`;
      }).join('');
    }

    function selectElement(id, event) {
      if (event) event.stopPropagation();
      if (!id) {
        selectedElement = null;
        document.getElementById('element-title').textContent = 'Test Plan Properties';
        document.getElementById('element-subtitle').textContent = currentTestPlan.testPlan.name;
        renderTestPlanProperties();
      } else {
        selectedElement = findElementById(currentTestPlan.testPlan.children, id);
        if (selectedElement) {
          document.getElementById('element-title').textContent = selectedElement.name;
          document.getElementById('element-subtitle').textContent = getTypeLabel(selectedElement.type);
          renderProperties(selectedElement);
        }
      }
      
      // Update selection styling without re-rendering entire tree
      document.querySelectorAll('.tree-item').forEach(el => el.classList.remove('selected'));
      if (id) {
        const selectedDiv = document.querySelector(\`.tree-item[onclick*="'\${id}'"]\`);
        if (selectedDiv) selectedDiv.classList.add('selected');
      }
    }

    function renderTestPlanProperties() {
      const container = document.getElementById('property-container');
      const testPlan = currentTestPlan.testPlan;
      
      container.innerHTML = \`
        <div class="property-panel">
          <div class="property-section">
            <div class="property-section-title">General</div>
            <div class="property-row">
              <label class="property-label">Test Plan Name</label>
              <input type="text" value="\${escapeHtml(testPlan.name)}" readonly />
            </div>
            <div class="property-row">
              <label class="property-label">JMeter Version</label>
              <input type="text" value="\${currentTestPlan.jmeter}" readonly />
              <div class="property-help">The version of JMeter used to create this test plan</div>
            </div>
          </div>
          
          <div class="property-section">
            <div class="property-section-title">Configuration</div>
            <div class="property-row">
              <label class="property-label">
                <input type="checkbox" \${testPlan.functionalMode ? 'checked' : ''} disabled />
                Functional Test Mode
              </label>
              <div class="property-help">Run in functional testing mode (saves response data)</div>
            </div>
            <div class="property-row">
              <label class="property-label">
                <input type="checkbox" \${testPlan.serializeThreadGroups ? 'checked' : ''} disabled />
                Run Thread Groups Consecutively
              </label>
              <div class="property-help">Run thread groups one after another instead of in parallel</div>
            </div>
          </div>
        </div>
      \`;
    }

    function renderProperties(element) {
      const container = document.getElementById('property-container');
      
      let propertiesHtml = \`
        <div class="property-panel">
          <div class="property-section">
            <div class="property-section-title">General</div>
            <div class="property-row">
              <label class="property-label">Element Type</label>
              <input type="text" value="\${getTypeLabel(element.type)}" readonly />
            </div>
            <div class="property-row">
              <label class="property-label">Name</label>
              <input type="text" value="\${escapeHtml(element.name)}" 
                onkeydown="handleInputKeydown(event, '\${element.id}', 'name', this)"
                onblur="saveProperty('\${element.id}', 'name', this.value)"
                oninput="updateProperty('\${element.id}', 'name', this.value)" 
                placeholder="Enter element name" />
              <div class="property-help">The display name for this element</div>
            </div>
            <div class="property-row">
              <label class="property-label">
                <input type="checkbox" \${element.enabled ? 'checked' : ''} 
                  onchange="toggleEnabled(event, '\${element.id}')" />
                Enabled
              </label>
              <div class="property-help">Uncheck to disable this element during test execution</div>
            </div>
          </div>
      \`;

      if (element.type === 'ThreadGroup' || element.type === 'SetupThreadGroup') {
        propertiesHtml += \`
          <div class="property-section">
            <div class="property-section-title">Thread Group Settings</div>
            <div class="property-row">
              <label class="property-label">Number of Threads (Users)</label>
              <input type="text" value="\${element.numThreads}" 
                onkeydown="handleInputKeydown(event, '\${element.id}', 'numThreads', this)"
                onblur="saveProperty('\${element.id}', 'numThreads', this.value)"
                oninput="updateProperty('\${element.id}', 'numThreads', this.value)" 
                placeholder="10" />
              <div class="property-help">Number of concurrent users to simulate</div>
            </div>
            <div class="property-row">
              <label class="property-label">Ramp-up Period (seconds)</label>
              <input type="text" value="\${element.rampTime}" 
                onkeydown="handleInputKeydown(event, '\${element.id}', 'rampTime', this)"
                onblur="saveProperty('\${element.id}', 'rampTime', this.value)"
                oninput="updateProperty('\${element.id}', 'rampTime', this.value)" 
                placeholder="60" />
              <div class="property-help">Time to start all threads (gradual load increase)</div>
            </div>
            <div class="property-row">
              <label class="property-label">Loop Count</label>
              <input type="text" value="\${element.loopController.loops}" 
                onkeydown="handleInputKeydown(event, '\${element.id}', 'loops', this)"
                onblur="saveLoopCount('\${element.id}', this.value)"
                oninput="updateLoopCount('\${element.id}', this.value)" 
                placeholder="1 or -1 for infinite" />
              <div class="property-help">Number of times to execute (-1 for infinite)</div>
            </div>
          </div>
        \`;
      }

      if (element.type === 'HTTPSamplerProxy') {
        propertiesHtml += \`
          <div class="property-section">
            <div class="property-section-title">HTTP Request</div>
            <div class="property-row">
              <label class="property-label">Protocol</label>
              <select onchange="saveProperty('\${element.id}', 'protocol', this.value)">
                <option value="http" \${element.protocol === 'http' ? 'selected' : ''}>HTTP</option>
                <option value="https" \${element.protocol === 'https' ? 'selected' : ''}>HTTPS</option>
              </select>
            </div>
            <div class="property-row">
              <label class="property-label">Server Name or IP</label>
              <input type="text" value="\${escapeHtml(element.domain)}" 
                onkeydown="handleInputKeydown(event, '\${element.id}', 'domain', this)"
                onblur="saveProperty('\${element.id}', 'domain', this.value)"
                oninput="updateProperty('\${element.id}', 'domain', this.value)" 
                placeholder="api.example.com" />
              <div class="property-help">The target server hostname or IP address</div>
            </div>
            <div class="property-row">
              <label class="property-label">Port Number</label>
              <input type="text" value="\${element.port || ''}" 
                onkeydown="handleInputKeydown(event, '\${element.id}', 'port', this)"
                onblur="saveProperty('\${element.id}', 'port', this.value)"
                oninput="updateProperty('\${element.id}', 'port', this.value)" 
                placeholder="" />
              <div class="property-help">Port number (leave empty for default)</div>
            </div>
            <div class="property-row">
              <label class="property-label">Path</label>
              <input type="text" value="\${escapeHtml(element.path)}" 
                onkeydown="handleInputKeydown(event, '\${element.id}', 'path', this)"
                onblur="saveProperty('\${element.id}', 'path', this.value)"
                oninput="updateProperty('\${element.id}', 'path', this.value)" 
                placeholder="/api/endpoint" />
              <div class="property-help">The URL path (e.g., /api/users)</div>
            </div>
            <div class="property-row">
              <label class="property-label">HTTP Method</label>
              <select onchange="saveProperty('\${element.id}', 'method', this.value)">
                <option value="GET" \${element.method === 'GET' ? 'selected' : ''}>GET</option>
                <option value="POST" \${element.method === 'POST' ? 'selected' : ''}>POST</option>
                <option value="PUT" \${element.method === 'PUT' ? 'selected' : ''}>PUT</option>
                <option value="DELETE" \${element.method === 'DELETE' ? 'selected' : ''}>DELETE</option>
                <option value="PATCH" \${element.method === 'PATCH' ? 'selected' : ''}>PATCH</option>
                <option value="HEAD" \${element.method === 'HEAD' ? 'selected' : ''}>HEAD</option>
                <option value="OPTIONS" \${element.method === 'OPTIONS' ? 'selected' : ''}>OPTIONS</option>
              </select>
            </div>
            <div class="property-row">
              <label class="property-label">Content Encoding</label>
              <input type="text" value="\${element.implementation || ''}" 
                onkeydown="handleInputKeydown(event, '\${element.id}', 'implementation', this)"
                onblur="saveProperty('\${element.id}', 'implementation', this.value)"
                oninput="updateProperty('\${element.id}', 'implementation', this.value)" 
                placeholder="" />
              <div class="property-help">Content encoding (e.g., UTF-8)</div>
            </div>
            <div class="property-row">
              <label class="property-label">
                <input type="checkbox" \${element.followRedirects ? 'checked' : ''} 
                  onchange="updatePropertyBool('\${element.id}', 'followRedirects', this.checked)" />
                Follow Redirects
              </label>
            </div>
            <div class="property-row">
              <label class="property-label">
                <input type="checkbox" \${element.useKeepAlive ? 'checked' : ''} 
                  onchange="updatePropertyBool('\${element.id}', 'useKeepAlive', this.checked)" />
                Use KeepAlive
              </label>
            </div>
            <div class="property-row">
              <label class="property-label">
                <input type="checkbox" \${element.postBodyRaw ? 'checked' : ''} 
                  onchange="updatePropertyBool('\${element.id}', 'postBodyRaw', this.checked)" />
                Use multipart/form-data
              </label>
            </div>
            \${element.bodyData ? \`
            <div class="property-row">
              <label class="property-label">Body Data</label>
              <textarea rows="8" readonly>\${escapeHtml(element.bodyData)}</textarea>
              <div class="property-help">Request body content (read-only)</div>
            </div>
            \` : ''}
          </div>
        \`;
      }

      if (element.type === 'RegexExtractor') {
        propertiesHtml += \`
          <div class="property-section">
            <div class="property-section-title">Regular Expression Extractor</div>
            <div class="property-row">
              <label class="property-label">Variable Name</label>
              <input type="text" value="\${escapeHtml(element.refName)}" 
                onkeydown="handleInputKeydown(event, '\${element.id}', 'refName', this)"
                onblur="saveProperty('\${element.id}', 'refName', this.value)"
                oninput="updateProperty('\${element.id}', 'refName', this.value)" 
                placeholder="myVariable" />
              <div class="property-help">Name of the variable to store extracted value</div>
            </div>
            <div class="property-row">
              <label class="property-label">Regular Expression</label>
              <input type="text" value="\${escapeHtml(element.regex)}" 
                onkeydown="handleInputKeydown(event, '\${element.id}', 'regex', this)"
                onblur="saveProperty('\${element.id}', 'regex', this.value)"
                oninput="updateProperty('\${element.id}', 'regex', this.value)" 
                placeholder="(.+?)" />
              <div class="property-help">Regex pattern to extract data from response</div>
            </div>
            <div class="property-row">
              <label class="property-label">Template</label>
              <input type="text" value="\${escapeHtml(element.template)}" 
                onkeydown="handleInputKeydown(event, '\${element.id}', 'template', this)"
                onblur="saveProperty('\${element.id}', 'template', this.value)"
                oninput="updateProperty('\${element.id}', 'template', this.value)" 
                placeholder="$1$" />
              <div class="property-help">Template for extracted value (e.g., $1$ for first group)</div>
            </div>
            <div class="property-row">
              <label class="property-label">Default Value</label>
              <input type="text" value="\${escapeHtml(element.defaultValue)}" 
                onkeydown="handleInputKeydown(event, '\${element.id}', 'defaultValue', this)"
                onblur="saveProperty('\${element.id}', 'defaultValue', this.value)"
                oninput="updateProperty('\${element.id}', 'defaultValue', this.value)" 
                placeholder="" />
              <div class="property-help">Value to use if regex doesn't match</div>
            </div>
            <div class="property-row">
              <label class="property-label">Match No.</label>
              <input type="text" value="\${element.matchNumber}" 
                onkeydown="handleInputKeydown(event, '\${element.id}', 'matchNumber', this)"
                onblur="saveProperty('\${element.id}', 'matchNumber', this.value)"
                oninput="updateProperty('\${element.id}', 'matchNumber', this.value)" 
                placeholder="1" />
              <div class="property-help">Which match to use (0=random, -1=all, 1=first, 2=second, etc.)</div>
            </div>
          </div>
        \`;
      }

      if (element.type === 'ResponseAssertion' && element.testStrings) {
        propertiesHtml += \`
          <div class="property-section">
            <div class="property-section-title">Response Assertion</div>
            <div class="property-row">
              <label class="property-label">Test Strings</label>
              <textarea rows="4" readonly>\${element.testStrings.join('\\n')}</textarea>
              <div class="property-help">Patterns to test against response</div>
            </div>
          </div>
        \`;
      }

      if (element.type === 'BeanShellAssertion' && element.query) {
        propertiesHtml += \`
          <div class="property-section">
            <div class="property-section-title">BeanShell Assertion</div>
            <div class="property-row">
              <label class="property-label">Script</label>
              <textarea rows="8" readonly>\${escapeHtml(element.query)}</textarea>
              <div class="property-help">BeanShell script code</div>
            </div>
          </div>
        \`;
      }

      if (element.type === 'HeaderManager' && element.headers) {
        propertiesHtml += \`
          <div class="property-section">
            <div class="property-section-title">HTTP Headers</div>
            \${element.headers.map((h, i) => \`
              <div class="property-row">
                <label class="property-label">\${escapeHtml(h.name)}</label>
                <input type="text" value="\${escapeHtml(h.value)}" readonly />
              </div>
            \`).join('')}
          </div>
        \`;
      }

      propertiesHtml += '</div>';
      container.innerHTML = propertiesHtml;
    }

    function updatePropertyBool(elementId, property, value) {
      const element = findElementById(currentTestPlan.testPlan.children, elementId);
      if (element) {
        element[property] = value;
        // Send update for checkboxes since they don't need continuous editing
        vscode.postMessage({
          type: 'update',
          data: currentTestPlan
        });
      }
    }

    function addElementToSelected() {
      const elementType = document.getElementById('newElementType').value;
      if (!elementType) {
        alert('Please select an element type');
        return;
      }
      
      let parent;
      if (selectedElement) {
        parent = findElementById([currentTestPlan.testPlan, ...currentTestPlan.testPlan.children], selectedElement.id);
      } else {
        parent = currentTestPlan.testPlan;
      }
      
      if (!parent) {
        alert('Parent not found');
        return;
      }
      
      const newElement = {
        id: 'jmeter-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
        type: elementType,
        testClass: elementType,
        guiClass: getGuiClass(elementType),
        name: getDefaultName(elementType),
        enabled: true,
        children: []
      };
      
      if (elementType === 'ThreadGroup') {
        newElement.numThreads = 1;
        newElement.rampTime = 1;
        newElement.scheduler = false;
        newElement.sameUserOnNextIteration = true;
        newElement.onSampleError = 'continue';
        newElement.loopController = { loops: 1, continueForever: false };
      } else if (elementType === 'SetupThreadGroup' || elementType === 'PostThreadGroup') {
        newElement.numThreads = 1;
        newElement.rampTime = 1;
        newElement.scheduler = false;
        newElement.sameUserOnNextIteration = true;
        newElement.onSampleError = 'continue';
        newElement.loopController = { loops: 1, continueForever: false };
      } else if (elementType === 'HTTPSamplerProxy') {
        newElement.domain = '';
        newElement.protocol = 'https';
        newElement.path = '/';
        newElement.method = 'GET';
        newElement.followRedirects = true;
        newElement.useKeepAlive = true;
        newElement.postBodyRaw = false;
        newElement.arguments = [];
      } else if (elementType === 'RegexExtractor') {
        newElement.refName = '';
        newElement.regex = '';
        newElement.template = '$1$';
        newElement.defaultValue = '';
        newElement.matchNumber = 1;
        newElement.useHeaders = false;
        newElement.defaultEmptyValue = false;
      } else if (elementType === 'JSONExtractor') {
        newElement.refName = '';
        newElement.jsonPath = '';
        newElement.defaultValue = '';
        newElement.matchNumber = 1;
      } else if (elementType === 'XPathExtractor') {
        newElement.refName = '';
        newElement.xpathQuery = '';
        newElement.defaultValue = '';
        newElement.matchNumber = 1;
      } else if (elementType === 'BoundaryExtractor') {
        newElement.refName = '';
        newElement.leftBoundary = '';
        newElement.rightBoundary = '';
        newElement.defaultValue = '';
        newElement.matchNumber = 1;
      } else if (elementType === 'ResponseAssertion') {
        newElement.testField = 'response_code';
        newElement.testType = 8;
        newElement.testStrings = ['200'];
        newElement.assumeSuccess = false;
      } else if (elementType === 'JSONAssertion') {
        newElement.jsonPath = '';
        newElement.expectedValue = '';
        newElement.expectNull = false;
        newElement.invert = false;
      } else if (elementType === 'XPathAssertion') {
        newElement.xpathQuery = '';
        newElement.validate = false;
        newElement.tolerant = false;
        newElement.ignoreWhitespace = true;
      } else if (elementType === 'DurationAssertion') {
        newElement.allowedDuration = 1000;
      } else if (elementType === 'SizeAssertion') {
        newElement.size = 0;
        newElement.operator = 1;
      } else if (elementType === 'HeaderManager') {
        newElement.headers = [];
      } else if (elementType === 'CookieManager') {
        newElement.clearEachIteration = false;
        newElement.controlledByThread = false;
      } else if (elementType === 'CacheManager') {
        newElement.clearEachIteration = false;
        newElement.useExpires = true;
      } else if (elementType === 'AuthManager') {
        newElement.authorizations = [];
      } else if (elementType === 'BeanShellAssertion') {
        newElement.query = '';
        newElement.resetInterpreter = false;
      } else if (elementType === 'JSR223PreProcessor' || elementType === 'JSR223PostProcessor') {
        newElement.scriptLanguage = 'groovy';
        newElement.script = '';
        newElement.parameters = '';
      } else if (elementType === 'ResultCollector' || elementType === 'ViewResultsTree' || elementType === 'SummaryReport' || elementType === 'AggregateReport' || elementType === 'SimpleDataWriter') {
        newElement.errorLogging = false;
      } else if (elementType === 'BackendListener') {
        newElement.classname = 'org.apache.jmeter.visualizers.backend.influxdb.InfluxdbBackendListenerClient';
        newElement.queueSize = 5000;
        newElement.arguments = [];
      } else if (elementType === 'IfController') {
        newElement.condition = '';
        newElement.evaluateAll = false;
        newElement.useExpression = true;
      } else if (elementType === 'WhileController') {
        newElement.condition = '';
      } else if (elementType === 'ForeachController') {
        newElement.inputVariable = '';
        newElement.returnVariable = '';
        newElement.useSeparator = true;
      } else if (elementType === 'TransactionController') {
        newElement.parent = false;
        newElement.includeTimers = true;
      } else if (elementType === 'LoopController') {
        newElement.loops = 1;
        newElement.continueForever = false;
      } else if (elementType === 'ConstantTimer') {
        newElement.delay = 300;
      } else if (elementType === 'UniformRandomTimer') {
        newElement.delay = 0;
        newElement.range = 100;
      } else if (elementType === 'GaussianRandomTimer') {
        newElement.delay = 0;
        newElement.range = 100;
      } else if (elementType === 'ConstantThroughputTimer') {
        newElement.throughput = 0;
        newElement.calcMode = 0;
      } else if (elementType === 'CSVDataSet') {
        newElement.filename = '';
        newElement.fileEncoding = 'UTF-8';
        newElement.variableNames = '';
        newElement.delimiter = ',';
        newElement.recycle = true;
        newElement.stopThread = false;
        newElement.shareMode = 'shareMode.all';
      } else if (elementType === 'UserDefinedVariables') {
        newElement.variables = [];
      } else if (elementType === 'Counter') {
        newElement.start = 1;
        newElement.increment = 1;
        newElement.maximum = Long.MAX_VALUE;
        newElement.format = '';
        newElement.referenceName = 'counter';
        newElement.perUser = false;
        newElement.resetOnThreadGroupIteration = false;
      }
      
      if (!parent.children) parent.children = [];
      parent.children.push(newElement);
      
      document.getElementById('newElementType').value = '';
      
      vscode.postMessage({
        type: 'update',
        data: currentTestPlan
      });
    }

    function addChildElement(parentId) {
      const childType = document.getElementById('childType').value;
      if (!childType) {
        alert('Please select an element type');
        return;
      }
      
      const parent = findElementById([currentTestPlan.testPlan, ...currentTestPlan.testPlan.children], parentId);
      if (!parent) {
        alert('Parent not found');
        return;
      }
      
      const newElement = {
        id: 'jmeter-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
        type: childType,
        testClass: childType,
        guiClass: getGuiClass(childType),
        name: getDefaultName(childType),
        enabled: true,
        children: []
      };
      
      // Add type-specific properties
      if (childType === 'HTTPSamplerProxy') {
        newElement.domain = '';
        newElement.protocol = 'https';
        newElement.path = '/';
        newElement.method = 'GET';
        newElement.followRedirects = true;
        newElement.useKeepAlive = true;
        newElement.postBodyRaw = false;
        newElement.arguments = [];
      } else if (childType === 'RegexExtractor') {
        newElement.refName = '';
        newElement.regex = '';
        newElement.template = '$1$';
        newElement.defaultValue = '';
        newElement.matchNumber = 1;
        newElement.useHeaders = false;
        newElement.defaultEmptyValue = false;
      } else if (childType === 'ResponseAssertion') {
        newElement.testField = 'response_code';
        newElement.testType = 8;
        newElement.testStrings = ['200'];
        newElement.assumeSuccess = false;
      } else if (childType === 'HeaderManager') {
        newElement.headers = [];
      } else if (childType === 'BeanShellAssertion') {
        newElement.query = '';
        newElement.resetInterpreter = false;
      } else if (childType === 'ResultCollector') {
        newElement.errorLogging = false;
      } else if (childType === 'ConstantThroughputTimer') {
        newElement.throughput = 0;
        newElement.calcMode = 0;
      } else if (childType === 'TestAction') {
        newElement.action = 1;
        newElement.target = 0;
        newElement.duration = 0;
      }
      
      if (!parent.children) parent.children = [];
      parent.children.push(newElement);
      
      vscode.postMessage({
        type: 'update',
        data: currentTestPlan
      });
    }
    
    function getGuiClass(type) {
      const map = {
        'ThreadGroup': 'ThreadGroupGui',
        'SetupThreadGroup': 'SetupThreadGroupGui',
        'PostThreadGroup': 'PostThreadGroupGui',
        'HTTPSamplerProxy': 'HttpTestSampleGui',
        'HeaderManager': 'HeaderPanel',
        'CookieManager': 'CookiePanel',
        'CacheManager': 'CacheManagerGui',
        'AuthManager': 'AuthPanel',
        'RegexExtractor': 'RegexExtractorGui',
        'JSONExtractor': 'JSONPostProcessorGui',
        'XPathExtractor': 'XPathExtractorGui',
        'BoundaryExtractor': 'BoundaryExtractorGui',
        'ResponseAssertion': 'AssertionGui',
        'JSONAssertion': 'JSONAssertionGui',
        'XPathAssertion': 'XPathAssertionGui',
        'DurationAssertion': 'DurationAssertionGui',
        'SizeAssertion': 'SizeAssertionGui',
        'JSR223Sampler': 'TestBeanGUI',
        'JSR223PreProcessor': 'TestBeanGUI',
        'JSR223PostProcessor': 'TestBeanGUI',
        'BeanShellAssertion': 'BeanShellAssertionGui',
        'ResultCollector': 'ViewResultsFullVisualizer',
        'ViewResultsTree': 'ViewResultsFullVisualizer',
        'SummaryReport': 'SummaryReport',
        'AggregateReport': 'StatVisualizer',
        'SimpleDataWriter': 'SimpleDataWriter',
        'BackendListener': 'BackendListenerGui',
        'IfController': 'IfControllerPanel',
        'WhileController': 'WhileControllerGui',
        'ForeachController': 'ForeachControllerPanel',
        'TransactionController': 'TransactionControllerGui',
        'LoopController': 'LoopControlPanel',
        'ConstantTimer': 'ConstantTimerGui',
        'UniformRandomTimer': 'UniformRandomTimerGui',
        'GaussianRandomTimer': 'GaussianRandomTimerGui',
        'ConstantThroughputTimer': 'TestBeanGUI',
        'CSVDataSet': 'TestBeanGUI',
        'UserDefinedVariables': 'ArgumentsPanel',
        'Counter': 'CounterConfigGui'
      };
      return map[type] || 'TestBeanGUI';
    }
    
    function getDefaultName(type) {
      const map = {
        'ThreadGroup': 'Thread Group',
        'SetupThreadGroup': 'setUp Thread Group',
        'PostThreadGroup': 'tearDown Thread Group',
        'HTTPSamplerProxy': 'HTTP Request',
        'HeaderManager': 'HTTP Header Manager',
        'CookieManager': 'HTTP Cookie Manager',
        'CacheManager': 'HTTP Cache Manager',
        'AuthManager': 'HTTP Authorization Manager',
        'RegexExtractor': 'Regular Expression Extractor',
        'JSONExtractor': 'JSON Extractor',
        'XPathExtractor': 'XPath Extractor',
        'BoundaryExtractor': 'Boundary Extractor',
        'ResponseAssertion': 'Response Assertion',
        'JSONAssertion': 'JSON Assertion',
        'XPathAssertion': 'XPath Assertion',
        'DurationAssertion': 'Duration Assertion',
        'SizeAssertion': 'Size Assertion',
        'JSR223Sampler': 'JSR223 Sampler',
        'JSR223PreProcessor': 'JSR223 PreProcessor',
        'JSR223PostProcessor': 'JSR223 PostProcessor',
        'BeanShellAssertion': 'BeanShell Assertion',
        'ResultCollector': 'View Results Tree',
        'ViewResultsTree': 'View Results Tree',
        'SummaryReport': 'Summary Report',
        'AggregateReport': 'Aggregate Report',
        'SimpleDataWriter': 'Simple Data Writer',
        'BackendListener': 'Backend Listener',
        'IfController': 'If Controller',
        'WhileController': 'While Controller',
        'ForeachController': 'ForEach Controller',
        'TransactionController': 'Transaction Controller',
        'LoopController': 'Loop Controller',
        'ConstantTimer': 'Constant Timer',
        'UniformRandomTimer': 'Uniform Random Timer',
        'GaussianRandomTimer': 'Gaussian Random Timer',
        'ConstantThroughputTimer': 'Constant Throughput Timer',
        'CSVDataSet': 'CSV Data Set Config',
        'UserDefinedVariables': 'User Defined Variables',
        'Counter': 'Counter'
      };
      return map[type] || type;
    }

    function handleInputKeydown(event, elementId, property, input) {
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        console.log('Cmd+S pressed, saving property:', property, 'value:', input.value);
        event.preventDefault();
        const element = findElementById(currentTestPlan.testPlan.children, elementId);
        if (element) {
          if (property === 'loops') {
            element.loopController.loops = input.value === '-1' ? -1 : parseInt(input.value) || 1;
          } else {
            element[property] = input.value;
          }
          // Save immediately without waiting for document update
          vscode.postMessage({
            type: 'update',
            data: currentTestPlan
          });
        }
        return false;
      }
    }

    function saveProperty(elementId, property, value) {
      const element = findElementById(currentTestPlan.testPlan.children, elementId);
      if (element) {
        element[property] = value;
        vscode.postMessage({
          type: 'update',
          data: currentTestPlan
        });
      }
    }
    
    function saveLoopCount(elementId, value) {
      const element = findElementById(currentTestPlan.testPlan.children, elementId);
      if (element) {
        element.loopController.loops = value === '-1' ? -1 : parseInt(value) || 1;
        vscode.postMessage({
          type: 'update',
          data: currentTestPlan
        });
      }
    }

    function updateProperty(elementId, property, value) {
      const element = findElementById(currentTestPlan.testPlan.children, elementId);
      if (element) {
        element[property] = value;
        // Don't send update message, just update local state
        // This prevents re-render and allows continued editing
      }
    }

    function updateLoopCount(elementId, value) {
      const element = findElementById(currentTestPlan.testPlan.children, elementId);
      if (element) {
        element.loopController.loops = value === '-1' ? -1 : parseInt(value) || 1;
        // Don't send update message
      }
    }

    function toggleEnabled(event, elementId) {
      if (event) event.stopPropagation();
      const testPlan = currentTestPlan;
      const element = findElementById(testPlan.testPlan.children, elementId);
      if (element) {
        element.enabled = !element.enabled;
        vscode.postMessage({
          type: 'update',
          data: testPlan
        });
      }
    }

    function deleteElement(event, elementId) {
      if (event) event.stopPropagation();
      
      const testPlan = currentTestPlan;
      if (removeElementById(testPlan.testPlan.children, elementId)) {
        vscode.postMessage({
          type: 'update',
          data: testPlan
        });
      }
    }

    function removeElementById(elements, id) {
      for (let i = 0; i < elements.length; i++) {
        if (elements[i].id === id) {
          elements.splice(i, 1);
          return true;
        }
        if (elements[i].children) {
          if (removeElementById(elements[i].children, id)) {
            return true;
          }
        }
      }
      return false;
    }

    function findElementById(elements, id) {
      for (const element of elements) {
        if (element.id === id) {
          return element;
        }
        if (element.children) {
          const found = findElementById(element.children, id);
          if (found) return found;
        }
      }
      return null;
    }

    function getIconForType(type) {
      const icons = {
        'ThreadGroup': '👥',
        'SetupThreadGroup': '⚙️',
        'PostThreadGroup': '🏁',
        'HTTPSamplerProxy': '🌐',
        'JSR223Sampler': '📜',
        'JSR223PreProcessor': '⚡',
        'JSR223PostProcessor': '⚡',
        'RegexExtractor': '🔍',
        'JSONExtractor': '📋',
        'XPathExtractor': '🔎',
        'BoundaryExtractor': '✂️',
        'ResponseAssertion': '✓',
        'JSONAssertion': '✓',
        'XPathAssertion': '✓',
        'DurationAssertion': '⏱️',
        'SizeAssertion': '📏',
        'BeanShellAssertion': '🔧',
        'HeaderManager': '📨',
        'CookieManager': '🍪',
        'CacheManager': '💾',
        'AuthManager': '🔐',
        'Arguments': '📝',
        'UserDefinedVariables': '📝',
        'ResultCollector': '📊',
        'ViewResultsTree': '🌳',
        'SummaryReport': '📋',
        'AggregateReport': '📈',
        'SimpleDataWriter': '💾',
        'BackendListener': '🔌',
        'TestAction': '⏸️',
        'IfController': '❓',
        'WhileController': '🔄',
        'ForeachController': '🔁',
        'TransactionController': '📦',
        'LoopController': '🔁',
        'ConstantTimer': '⏱️',
        'UniformRandomTimer': '🎲',
        'GaussianRandomTimer': '🎲',
        'ConstantThroughputTimer': '⏱️',
        'CSVDataSet': '📄',
        'Counter': '🔢'
      };
      return icons[type] || '📄';
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    function getTypeLabel(type) {
      const labels = {
        'ThreadGroup': 'Thread Group',
        'SetupThreadGroup': 'Setup Thread Group',
        'PostThreadGroup': 'Teardown Thread Group',
        'HTTPSamplerProxy': 'HTTP Request',
        'JSR223Sampler': 'JSR223 Sampler',
        'JSR223PreProcessor': 'JSR223 PreProcessor',
        'JSR223PostProcessor': 'JSR223 PostProcessor',
        'RegexExtractor': 'Regex Extractor',
        'JSONExtractor': 'JSON Extractor',
        'XPathExtractor': 'XPath Extractor',
        'BoundaryExtractor': 'Boundary Extractor',
        'ResponseAssertion': 'Response Assertion',
        'JSONAssertion': 'JSON Assertion',
        'XPathAssertion': 'XPath Assertion',
        'DurationAssertion': 'Duration Assertion',
        'SizeAssertion': 'Size Assertion',
        'BeanShellAssertion': 'BeanShell Assertion',
        'HeaderManager': 'HTTP Header Manager',
        'CookieManager': 'HTTP Cookie Manager',
        'CacheManager': 'HTTP Cache Manager',
        'AuthManager': 'HTTP Authorization Manager',
        'Arguments': 'User Variables',
        'UserDefinedVariables': 'User Defined Variables',
        'ResultCollector': 'Listener',
        'ViewResultsTree': 'View Results Tree',
        'SummaryReport': 'Summary Report',
        'AggregateReport': 'Aggregate Report',
        'SimpleDataWriter': 'Simple Data Writer',
        'BackendListener': 'Backend Listener',
        'TestAction': 'Flow Control',
        'IfController': 'If Controller',
        'WhileController': 'While Controller',
        'ForeachController': 'ForEach Controller',
        'TransactionController': 'Transaction Controller',
        'LoopController': 'Loop Controller',
        'ConstantTimer': 'Constant Timer',
        'UniformRandomTimer': 'Uniform Random Timer',
        'GaussianRandomTimer': 'Gaussian Random Timer',
        'ConstantThroughputTimer': 'Throughput Timer',
        'CSVDataSet': 'CSV Data Set Config',
        'Counter': 'Counter'
      };
      return labels[type] || type;
    }

    function toggleChildren(childId, arrowEl) {
      const el = document.getElementById(childId);
      if (!el) return;
      
      const isCurrentlyVisible = el.style.display === 'block' || el.style.display === '';
      
      if (isCurrentlyVisible) {
        // Collapsing
        el.style.display = 'none';
        arrowEl.textContent = '▶';
      } else {
        // Expanding - collapse siblings only (not all elements)
        if (childId !== 'testplan-children') {
          const parent = el.parentElement.parentElement;
          if (parent) {
            parent.querySelectorAll(':scope > div > .tree-children').forEach(other => {
              if (other.id !== childId) {
                other.style.display = 'none';
                const otherArrow = document.querySelector('.toggle-arrow[data-target="' + other.id + '"]');
                if (otherArrow) otherArrow.textContent = '▶';
              }
            });
          }
        }
        el.style.display = 'block';
        arrowEl.textContent = '▼';
      }
    }

    function collapseAll() {
      document.querySelectorAll('.tree-children').forEach(el => {
        el.style.display = 'none';
      });
      document.querySelectorAll('.toggle-arrow').forEach(el => {
        el.textContent = '▶';
      });
    }

    function expandAll() {
      document.querySelectorAll('.tree-children').forEach(el => {
        el.style.display = 'block';
      });
      document.querySelectorAll('.toggle-arrow').forEach(el => {
        el.textContent = '▼';
      });
    }

    vscode.postMessage({ type: 'ready' });
  </script>
</body>
</html>`;
  }
}
