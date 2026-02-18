# JMeter VS Code Extension

A Visual Studio Code extension that provides a visual, domain-specific editor for Apache JMeter test plans (.jmx files) with integrated test execution and results visualization.

## ✨ Features

### Visual Editor
- **Tree View**: Hierarchical display with collapsible elements and color-coded hierarchy levels
- **Property Editing**: Live editing with auto-save (Cmd+S) and blur events
- **Enable/Disable**: Toggle elements on/off with a single click
- **Delete Elements**: Remove unwanted elements with undo support
- **Add Elements**: Dropdown with 40+ JMeter element types organized by category
- **Graph View**: Visual representation of test plan structure
- **Real-time Sync**: Bidirectional synchronization between UI and .jmx file

### Test Execution
- **JMeter CLI Integration**: Execute tests directly from VS Code
- **Auto-detection**: Finds JMeter installation (JMETER_HOME, PATH, Homebrew)
- **Real-time Progress**: Live updates during test execution
- **Detailed Output**: Request/response headers and bodies in console
- **Results Management**: Recent test results with persistent storage

### Results Visualization
- **Interactive Charts**: 6 Chart.js visualizations (response times, throughput, errors, percentiles, status codes, timeline)
- **Tabbed Interface**: Overview, Details, Errors, Timeline, Statistics views
- **Filter & Search**: Find specific samples quickly
- **Export**: Save results as CSV or HTML reports
- **Performance**: Handles up to 500 samples efficiently

### Supported Elements (45+)
- **Thread Groups**: ThreadGroup, SetupThreadGroup, PostThreadGroup
- **Samplers**: HTTP Request, JSR223 Sampler
- **Controllers**: If, While, ForEach, Transaction, Loop
- **Config**: CSV Data Set, User Variables, Header/Cookie/Cache/Auth Managers, Counter
- **Timers**: Constant, Uniform Random, Gaussian Random, Constant Throughput
- **Pre/Post Processors**: JSR223, Regex/JSON/XPath/Boundary Extractors
- **Assertions**: Response, JSON, XPath, Duration, Size, BeanShell
- **Listeners**: View Results Tree, Summary/Aggregate Reports, Simple Data Writer, Backend Listener

## 🚀 Getting Started

### Installation

1. **Install from VS Code Marketplace**
   - Open VS Code
   - Go to Extensions (Cmd+Shift+X / Ctrl+Shift+X)
   - Search for "JMeter Test Plan Editor"
   - Click Install

2. **Install Apache JMeter** (required for test execution)

   **macOS (Homebrew)**:
   ```bash
   brew install jmeter
   ```
   
   **macOS (Manual)**:
   ```bash
   # Download from https://jmeter.apache.org/download_jmeter.cgi
   # Extract and add to PATH
   export PATH=$PATH:/path/to/apache-jmeter-5.x/bin
   ```
   
   **Windows**:
   ```powershell
   # Download from https://jmeter.apache.org/download_jmeter.cgi
   # Extract to C:\jmeter
   # Add to PATH: C:\jmeter\bin
   ```
   
   **Linux**:
   ```bash
   sudo apt install jmeter  # Ubuntu/Debian
   # or download from https://jmeter.apache.org/download_jmeter.cgi
   ```

3. **Configure JMeter Path** (if auto-detection fails)
   - Open VS Code Settings (Cmd+, / Ctrl+,)
   - Search for "JMeter Path"
   - Set the path to your JMeter executable:
     - **macOS Homebrew**: `/opt/homebrew/bin/jmeter`
     - **macOS Manual**: `/usr/local/apache-jmeter-5.x/bin/jmeter`
     - **Windows**: `C:\jmeter\bin\jmeter.bat`
     - **Linux**: `/usr/bin/jmeter` or `/opt/jmeter/bin/jmeter`
   
   Or use Command Palette:
   - Press Cmd+Shift+P / Ctrl+Shift+P
   - Run "JMeter: Configure JMeter Path"

### Verify Installation

1. Open any `.jmx` file
2. Right-click → "Open with JMeter Visual Editor"
3. The visual editor should open
4. Try running a test with "JMeter: Run Test" command

### For Development

1. Clone the repository:
```bash
git clone https://github.com/yourusername/jmeter-vscode-extension.git
cd jmeter-vscode-extension
```

2. Install dependencies:
```bash
npm install
```

3. Compile TypeScript:
```bash
npm run compile
```

4. Launch Extension Development Host:
- Press `F5` in VS Code
- Or run "Debug: Start Debugging" from Command Palette

### Usage

#### Opening a Test Plan

1. Right-click a `.jmx` file in Explorer
2. Select "Open with JMeter Visual Editor"
3. The visual editor opens automatically

#### Editing Properties

1. Click any element in the tree view
2. Edit properties in the right panel
3. Changes save on blur or press `Cmd+S` (Mac) / `Ctrl+S` (Windows)

#### Managing Elements

- **Expand/Collapse**: Click arrow next to element (siblings auto-collapse)
- **Enable/Disable**: Click ✅/❌ icon
- **Delete**: Click 🗑️ icon (use Cmd+Z to undo)
- **Add Element**: Select type from dropdown and click ➕ Add

#### Running Tests

1. Open a `.jmx` file
2. Run command: `JMeter: Run Test`
3. View real-time progress in console
4. Results saved to `logs/` folder

#### Viewing Results

1. Right-click a `.jtl` file in Explorer
2. Select "View JMeter Results"
3. Explore charts, filter samples, export reports

## 📋 Commands

| Command | Description |
|---------|-------------|
| `JMeter: Open with Visual Editor` | Open .jmx file in visual editor |
| `JMeter: Run Test` | Execute test plan with JMeter CLI |
| `JMeter: Stop Test` | Stop running test execution |
| `JMeter: View Recent Results` | Show list of recent test results |
| `JMeter: View Results Chart` | Open results visualization |
| `JMeter: Configure JMeter Path` | Set custom JMeter installation path |

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│         VS Code Extension Host          │
├─────────────────────────────────────────┤
│  Custom Editor Provider (WebView)       │
│  - Tree view with collapsible elements  │
│  - Property panel with live editing     │
│  - Graph visualization                  │
├─────────────────────────────────────────┤
│  JMeter Model Layer                     │
│  - Domain Objects (TypeScript)          │
│  - Type-safe operations                 │
├─────────────────────────────────────────┤
│  Parser/Serializer Layer                │
│  - JMX → Model (xml2js)                 │
│  - Model → JMX (xmlbuilder2)            │
├─────────────────────────────────────────┤
│  Test Execution Layer                   │
│  - JMeter CLI integration               │
│  - Real-time JTL parsing                │
│  - Progress tracking                    │
├─────────────────────────────────────────┤
│  Results Visualization Layer            │
│  - Chart.js integration                 │
│  - CSV/HTML export                      │
│  - Filter and search                    │
└─────────────────────────────────────────┘
```

### Key Components

- **JMXParser** (`src/parser/JMXParser.ts`): Converts JMX XML to domain model using xml2js
- **JMXSerializer** (`src/parser/JMXSerializer.ts`): Converts model back to valid JMX XML using xmlbuilder2
- **Domain Model** (`src/model/types.ts`): TypeScript interfaces for 45+ JMeter element types
- **JMeterEditorProvider** (`src/extension/JMeterEditorProvider.ts`): Custom text editor with WebView UI
- **TestExecutor** (`src/execution/TestExecutor.ts`): JMeter CLI integration with auto-detection
- **JTLParser** (`src/results/JTLParser.ts`): Parses CSV and XML JTL result files
- **ResultsViewerProvider** (`src/results/ResultsViewerProvider.ts`): Chart.js-based results visualization

## 🔧 Development

### Project Structure

```
jmeter-vscode-extension/
├── src/
│   ├── extension/
│   │   ├── extension.ts              # Entry point
│   │   ├── JMeterEditorProvider.ts   # Custom editor with WebView
│   │   └── commands.ts               # Command handlers
│   ├── model/
│   │   └── types.ts                  # Domain model (45+ types)
│   ├── parser/
│   │   ├── JMXParser.ts              # XML → Model
│   │   └── JMXSerializer.ts          # Model → XML
│   ├── execution/
│   │   └── TestExecutor.ts           # JMeter CLI integration
│   └── results/
│       ├── JTLParser.ts              # JTL file parser
│       └── ResultsViewerProvider.ts  # Chart.js visualization
├── logs/                         # Test execution logs
├── package.json
├── tsconfig.json
└── README.md
```

### Building

```bash
# Compile TypeScript
npm run compile

# Watch mode for development
npm run watch
```

### Testing

```bash
# Run in Extension Development Host
# Press F5 in VS Code
```

## 📝 Examples

### Parsing a Test Plan

```typescript
import { JMXParser } from './src/parser/JMXParser';
import * as fs from 'fs';

const parser = new JMXParser();
const xmlContent = fs.readFileSync('test.jmx', 'utf-8');
const testPlan = await parser.parse(xmlContent);

console.log(testPlan.testPlan.name);
console.log(`Elements: ${testPlan.testPlan.children.length}`);
```

### Serializing a Test Plan

```typescript
import { JMXSerializer } from './src/parser/JMXSerializer';
import * as fs from 'fs';

const serializer = new JMXSerializer();
const xml = serializer.serialize(testPlan);

fs.writeFileSync('output.jmx', xml);
```

### Executing a Test

```typescript
import { TestExecutor } from './src/execution/TestExecutor';

const executor = new TestExecutor();
const jmeterPath = await executor.findJMeterPath();

if (jmeterPath) {
  await executor.executeTest('/path/to/test.jmx');
}
```

### Parsing Results

```typescript
import { JTLParser } from './src/results/JTLParser';
import * as fs from 'fs';

const parser = new JTLParser();
const jtlContent = fs.readFileSync('results.jtl', 'utf-8');
const results = parser.parse(jtlContent);

console.log(`Total samples: ${results.samples.length}`);
console.log(`Errors: ${results.samples.filter(s => !s.success).length}`);
```

## 🎯 Design Principles

1. **Model-First**: All operations work on structured domain model, not raw XML
2. **Type Safety**: Leverage TypeScript for compile-time guarantees
3. **Separation of Concerns**: Clear boundaries between parser, model, UI, and execution layers
4. **Real-time Feedback**: Live editing with immediate visual updates
5. **Extensible**: Easy to add new element types and features

## 🚧 Roadmap

### Phase 1-5 ✅ COMPLETE
- [x] JMX Parser with xml2js
- [x] Domain model with 45+ element types
- [x] JMX Serializer with xmlbuilder2
- [x] Visual editor with WebView
- [x] Property editing with live updates
- [x] Enable/disable/delete elements
- [x] Document synchronization
- [x] Test execution with JMeter CLI
- [x] Results visualization with Chart.js
- [x] Export to CSV/HTML

### Phase 6 (Next)
- [ ] Drag-and-drop reordering
- [ ] Element duplication
- [ ] Test plan templates
- [ ] Variable extraction helper
- [ ] Correlation assistant

### Phase 7 (Future)
- [ ] Distributed testing support
- [ ] Performance comparison
- [ ] CI/CD integration
- [ ] Cloud execution

## 🤝 Contributing

Contributions are welcome! Key areas:

1. **Element Support**: Add more JMeter element types and properties
2. **UI Enhancements**: Improve visual editor and user experience
3. **Test Execution**: Add support for distributed testing
4. **Results Analysis**: Enhanced metrics and visualizations
5. **Documentation**: Improve guides and examples

### Development Setup

1. Fork the repository
2. Clone your fork: `git clone https://github.com/yourusername/jmeter-vscode-extension.git`
3. Install dependencies: `npm install`
4. Make your changes
5. Test with `F5` in VS Code
6. Submit a pull request

## 📚 Resources

- [JMeter Documentation](https://jmeter.apache.org/usermanual/)
- [VS Code Extension API](https://code.visualstudio.com/api)
- [Custom Editor Guide](https://code.visualstudio.com/api/extension-guides/custom-editors)

## 📄 License

MIT

## 🙏 Acknowledgments

- Apache JMeter team for the amazing load testing tool
- VS Code team for the excellent extension API
- Community contributors

---

**Made with ❤️ for performance testers**