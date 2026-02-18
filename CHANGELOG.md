# Change Log

All notable changes to the "JMeter Test Plan Editor" extension will be documented in this file.

## [0.1.1] - 2024-01-15

### Fixed
- Updated extension icon with modern design
- Improved icon transparency and visual quality

## [0.1.0] - 2024-01-15

### Added
- Visual editor for JMeter test plans (.jmx files)
- Tree view with collapsible elements and color-coded hierarchy
- Property editing with live updates and auto-save (Cmd+S)
- Enable/disable/delete element operations
- Add element dropdown with 45+ JMeter element types
- Graph view for test plan visualization
- JMeter CLI integration with auto-detection
- Test execution directly from VS Code
- Real-time progress tracking during test execution
- Detailed console output with request/response headers and bodies
- Results visualization with 6 interactive Chart.js charts
- Tabbed interface for results (Overview, Details, Errors, Timeline, Statistics)
- Filter and search functionality for test results
- Export results to CSV and HTML
- Recent test results management
- Support for 45+ JMeter element types including:
  - Thread Groups (ThreadGroup, SetupThreadGroup, PostThreadGroup)
  - Samplers (HTTP Request, JSR223 Sampler)
  - Controllers (If, While, ForEach, Transaction, Loop)
  - Config Elements (CSV Data Set, User Variables, Managers, Counter)
  - Timers (Constant, Uniform Random, Gaussian Random, Constant Throughput)
  - Pre/Post Processors (JSR223, Regex/JSON/XPath/Boundary Extractors)
  - Assertions (Response, JSON, XPath, Duration, Size, BeanShell)
  - Listeners (View Results Tree, Summary/Aggregate Reports, Simple Data Writer, Backend Listener)

### Features
- Bidirectional synchronization between UI and .jmx file
- Type-safe domain model with TypeScript
- JMX parsing with xml2js
- JMX serialization with xmlbuilder2
- Handles up to 500 samples efficiently in results viewer
- Auto-detection of JMeter installation (JMETER_HOME, PATH, Homebrew)
- Persistent storage for recent test results

## [Unreleased]

### Planned
- Drag-and-drop element reordering
- Element duplication
- Test plan templates
- Variable extraction helper
- Correlation assistant
