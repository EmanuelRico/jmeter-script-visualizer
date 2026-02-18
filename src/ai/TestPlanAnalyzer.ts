import {
  JMeterTestPlan,
  BaseElement,
  ThreadGroup,
  HTTPSamplerProxy,
  isThreadGroup,
  isHTTPSampler
} from '../model/types';

export interface AnalysisResult {
  severity: 'info' | 'warning' | 'error';
  category: 'performance' | 'best-practice' | 'security' | 'maintainability';
  message: string;
  element?: string;
  suggestion?: string;
}

/**
 * Analyzes JMeter test plans for anti-patterns and issues
 * Provides structured, actionable feedback
 */
export class TestPlanAnalyzer {
  analyze(testPlan: JMeterTestPlan): AnalysisResult[] {
    const results: AnalysisResult[] = [];

    results.push(...this.analyzeThreadGroups(testPlan.testPlan.children));
    results.push(...this.analyzeSamplers(testPlan.testPlan.children));
    results.push(...this.analyzeSecurityIssues(testPlan.testPlan.children));
    results.push(...this.analyzeStructure(testPlan.testPlan.children));

    return results;
  }

  private analyzeThreadGroups(elements: BaseElement[]): AnalysisResult[] {
    const results: AnalysisResult[] = [];
    const threadGroups = this.findElementsByType<ThreadGroup>(elements, isThreadGroup);

    if (threadGroups.length === 0) {
      results.push({
        severity: 'warning',
        category: 'best-practice',
        message: 'No thread groups found in test plan',
        suggestion: 'Add at least one thread group to execute samplers'
      });
    }

    for (const tg of threadGroups) {
      // Check for high thread count without ramp-up
      const threads = typeof tg.numThreads === 'number' ? tg.numThreads : 0;
      const rampTime = typeof tg.rampTime === 'number' ? tg.rampTime : 0;

      if (threads > 100 && rampTime < 60) {
        results.push({
          severity: 'warning',
          category: 'performance',
          message: `Thread group "${tg.name}" has ${threads} threads with only ${rampTime}s ramp-up`,
          element: tg.name,
          suggestion: 'Consider increasing ramp-up time to avoid overwhelming the target system'
        });
      }

      // Check for infinite loops without duration
      if (tg.loopController.loops === -1 && !tg.duration) {
        results.push({
          severity: 'warning',
          category: 'best-practice',
          message: `Thread group "${tg.name}" has infinite loops without duration limit`,
          element: tg.name,
          suggestion: 'Set a duration or use finite loop count to prevent runaway tests'
        });
      }

      // Check for empty thread groups
      if (tg.children.length === 0) {
        results.push({
          severity: 'info',
          category: 'maintainability',
          message: `Thread group "${tg.name}" is empty`,
          element: tg.name,
          suggestion: 'Add samplers or remove unused thread group'
        });
      }
    }

    return results;
  }

  private analyzeSamplers(elements: BaseElement[]): AnalysisResult[] {
    const results: AnalysisResult[] = [];
    const samplers = this.findAllSamplers(elements);

    for (const sampler of samplers) {
      if (isHTTPSampler(sampler)) {
        // Check for missing assertions
        const hasAssertions = sampler.children.some(c => 
          c.type === 'ResponseAssertion' || c.type === 'BeanShellAssertion'
        );

        if (!hasAssertions) {
          results.push({
            severity: 'info',
            category: 'best-practice',
            message: `HTTP Sampler "${sampler.name}" has no assertions`,
            element: sampler.name,
            suggestion: 'Add response assertions to validate server responses'
          });
        }

        // Check for hardcoded credentials in URL
        if (sampler.path.includes('password') || sampler.path.includes('token')) {
          results.push({
            severity: 'warning',
            category: 'security',
            message: `HTTP Sampler "${sampler.name}" may contain credentials in URL`,
            element: sampler.name,
            suggestion: 'Use variables or property files for sensitive data'
          });
        }

        // Check for missing domain
        if (!sampler.domain) {
          results.push({
            severity: 'error',
            category: 'best-practice',
            message: `HTTP Sampler "${sampler.name}" has no domain configured`,
            element: sampler.name,
            suggestion: 'Configure the server domain or use a variable'
          });
        }
      }
    }

    return results;
  }

  private analyzeSecurityIssues(elements: BaseElement[]): AnalysisResult[] {
    const results: AnalysisResult[] = [];
    
    // Check for hardcoded credentials
    const allElements = this.flattenElements(elements);
    
    for (const element of allElements) {
      if (element.type === 'Arguments') {
        // Check user defined variables for potential secrets
        results.push({
          severity: 'info',
          category: 'security',
          message: 'Review user-defined variables for hardcoded credentials',
          element: element.name,
          suggestion: 'Use property files or environment variables for sensitive data'
        });
      }

      if (element.type === 'HeaderManager') {
        results.push({
          severity: 'info',
          category: 'security',
          message: 'Review HTTP headers for hardcoded tokens or credentials',
          element: element.name,
          suggestion: 'Use variables for Authorization headers and API keys'
        });
      }
    }

    return results;
  }

  private analyzeStructure(elements: BaseElement[]): AnalysisResult[] {
    const results: AnalysisResult[] = [];
    const allElements = this.flattenElements(elements);

    // Check for disabled elements
    const disabledElements = allElements.filter(e => !e.enabled);
    if (disabledElements.length > 5) {
      results.push({
        severity: 'info',
        category: 'maintainability',
        message: `Test plan has ${disabledElements.length} disabled elements`,
        suggestion: 'Consider removing unused elements to improve maintainability'
      });
    }

    // Check for listeners (can impact performance)
    const listeners = allElements.filter(e => e.type === 'ResultCollector');
    if (listeners.length > 3) {
      results.push({
        severity: 'warning',
        category: 'performance',
        message: `Test plan has ${listeners.length} listeners`,
        suggestion: 'Disable listeners during load tests to reduce overhead'
      });
    }

    return results;
  }

  private findElementsByType<T extends BaseElement>(
    elements: BaseElement[],
    predicate: (e: BaseElement) => e is T
  ): T[] {
    const results: T[] = [];
    
    for (const element of elements) {
      if (predicate(element)) {
        results.push(element);
      }
      if (element.children) {
        results.push(...this.findElementsByType(element.children, predicate));
      }
    }
    
    return results;
  }

  private findAllSamplers(elements: BaseElement[]): BaseElement[] {
    const samplers: BaseElement[] = [];
    
    for (const element of elements) {
      if (element.type === 'HTTPSamplerProxy' || element.type === 'JSR223Sampler') {
        samplers.push(element);
      }
      if (element.children) {
        samplers.push(...this.findAllSamplers(element.children));
      }
    }
    
    return samplers;
  }

  private flattenElements(elements: BaseElement[]): BaseElement[] {
    const flattened: BaseElement[] = [];
    
    for (const element of elements) {
      flattened.push(element);
      if (element.children) {
        flattened.push(...this.flattenElements(element.children));
      }
    }
    
    return flattened;
  }

  /**
   * Generates a human-readable explanation of what the test plan does
   */
  explainTestPlan(testPlan: JMeterTestPlan): string {
    const threadGroups = this.findElementsByType(testPlan.testPlan.children, isThreadGroup);
    const samplers = this.findAllSamplers(testPlan.testPlan.children);

    let explanation = `This JMeter test plan "${testPlan.testPlan.name}" `;

    if (threadGroups.length === 0) {
      return explanation + 'is empty and contains no thread groups.';
    }

    explanation += `contains ${threadGroups.length} thread group(s) with a total of ${samplers.length} sampler(s).\n\n`;

    for (const tg of threadGroups) {
      const threads = tg.numThreads;
      const rampTime = tg.rampTime;
      const loops = tg.loopController.loops;
      const groupSamplers = this.findAllSamplers(tg.children);

      explanation += `Thread Group "${tg.name}":\n`;
      explanation += `- Simulates ${threads} concurrent users\n`;
      explanation += `- Ramps up over ${rampTime} seconds\n`;
      explanation += `- Executes ${loops === -1 ? 'infinite' : loops} iteration(s)\n`;
      explanation += `- Contains ${groupSamplers.length} request(s)\n\n`;

      if (groupSamplers.length > 0 && groupSamplers.length <= 5) {
        explanation += 'Requests:\n';
        for (const sampler of groupSamplers) {
          if (isHTTPSampler(sampler)) {
            explanation += `  - ${sampler.method} ${sampler.protocol}://${sampler.domain}${sampler.path}\n`;
          } else {
            explanation += `  - ${sampler.name}\n`;
          }
        }
        explanation += '\n';
      }
    }

    return explanation.trim();
  }
}
