import { parseStringPromise } from 'xml2js';
import {
  JMeterTestPlan,
  TestPlan,
  ThreadGroup,
  HTTPSamplerProxy,
  BaseElement,
  RegexExtractor,
  ResponseAssertion,
  HeaderManager,
  Header,
  Argument,
  HTTPArgument,
  LoopController,
  ElementType,
  BeanShellAssertion,
  ResultCollector
} from '../model/types';

/**
 * Parses JMX XML into structured domain model
 * Handles JMeter's unique hashTree structure
 */
export class JMXParser {
  async parse(xmlContent: string): Promise<JMeterTestPlan> {
    const parsed = await parseStringPromise(xmlContent, {
      explicitArray: true,
      mergeAttrs: true
    });

    const root = parsed.jmeterTestPlan;
    const hashTree = root.hashTree[0];
    
    const testPlanXml = hashTree.TestPlan[0];
    const testPlanChildren = hashTree.hashTree[0];

    return {
      version: root.version,
      properties: root.properties,
      jmeter: root.jmeter,
      testPlan: this.parseTestPlan(testPlanXml, testPlanChildren)
    };
  }

  private parseTestPlan(xml: any, childrenHashTree: any): TestPlan {
    const testPlan: TestPlan = {
      id: this.generateId(),
      type: 'TestPlan',
      testClass: 'TestPlan',
      guiClass: 'TestPlanGui',
      name: Array.isArray(xml.testname) ? xml.testname[0] : (xml.testname || 'Test Plan'),
      enabled: true,
      functionalMode: this.parseBoolProp(xml, 'TestPlan.functional_mode'),
      serializeThreadGroups: this.parseBoolProp(xml, 'TestPlan.serialize_threadgroups'),
      userDefinedVariables: this.parseUserDefinedVariables(xml),
      children: []
    };

    if (childrenHashTree) {
      testPlan.children = this.parseHashTree(childrenHashTree);
    }

    return testPlan;
  }

  private parseHashTree(hashTree: any): BaseElement[] {
    if (!hashTree) return [];
    
    const elements: BaseElement[] = [];
    const keys = Object.keys(hashTree).filter(k => k !== 'hashTree');
    const hashTrees = hashTree.hashTree || [];

    let hashTreeIndex = 0;
    for (const key of keys) {
      const elementArray = hashTree[key];
      if (!Array.isArray(elementArray)) continue;

      for (const elementXml of elementArray) {
        const childHashTree = hashTrees[hashTreeIndex];
        const element = this.parseElement(key, elementXml, childHashTree);
        if (element) {
          elements.push(element);
        }
        hashTreeIndex++;
      }
    }

    return elements;
  }

  private parseElement(tagName: string, xml: any, childHashTree: any): BaseElement | null {
    const testClass = Array.isArray(xml.testclass) ? xml.testclass[0] : xml.testclass;
    if (!testClass) {
      return null;
    }

    switch (testClass) {
      case 'ThreadGroup':
      case 'SetupThreadGroup':
      case 'PostThreadGroup':
        return this.parseThreadGroup(xml, childHashTree, testClass as any);
      
      case 'HTTPSamplerProxy':
        return this.parseHTTPSampler(xml, childHashTree);
      
      case 'RegexExtractor':
        return this.parseRegexExtractor(xml);
      
      case 'ResponseAssertion':
        return this.parseResponseAssertion(xml);
      
      case 'HeaderManager':
        return this.parseHeaderManager(xml);
      
      case 'Arguments':
        return this.parseArguments(xml);
      
      case 'JSR223Sampler':
        return this.parseJSR223Sampler(xml, childHashTree);
      
      case 'JSR223PostProcessor':
        return this.parseJSR223PostProcessor(xml);
      
      case 'BeanShellAssertion':
        return this.parseBeanShellAssertion(xml);
      
      case 'ResultCollector':
        return this.parseResultCollector(xml);
      
      case 'TestAction':
        return this.parseTestAction(xml, childHashTree);
      
      case 'ConstantThroughputTimer':
        return this.parseConstantThroughputTimer(xml);
      
      default:
        return null;
    }
  }

  private parseThreadGroup(xml: any, childHashTree: any, type: 'ThreadGroup' | 'SetupThreadGroup' | 'PostThreadGroup'): ThreadGroup {
    const threadGroup: ThreadGroup = {
      id: this.generateId(),
      type,
      testClass: type,
      guiClass: this.getStringValue(xml.guiclass) || 'ThreadGroupGui',
      name: this.getStringValue(xml.testname) || 'Thread Group',
      enabled: this.getStringValue(xml.enabled) !== 'false',
      comments: this.parseStringProp(xml, 'TestPlan.comments'),
      numThreads: this.parseIntOrStringProp(xml, 'ThreadGroup.num_threads') || 1,
      rampTime: this.parseIntOrStringProp(xml, 'ThreadGroup.ramp_time') || 1,
      duration: this.parseIntOrStringProp(xml, 'ThreadGroup.duration'),
      delay: this.parseIntOrStringProp(xml, 'ThreadGroup.delay'),
      scheduler: this.parseBoolProp(xml, 'ThreadGroup.scheduler'),
      sameUserOnNextIteration: this.parseBoolProp(xml, 'ThreadGroup.same_user_on_next_iteration'),
      onSampleError: this.parseStringProp(xml, 'ThreadGroup.on_sample_error') as any || 'continue',
      loopController: this.parseLoopController(xml),
      children: []
    };

    if (childHashTree) {
      threadGroup.children = this.parseHashTree(childHashTree);
    }

    return threadGroup;
  }

  private getStringValue(val: any): string | undefined {
    if (Array.isArray(val)) return val[0];
    return val;
  }

  private parseHTTPSampler(xml: any, childHashTree: any): HTTPSamplerProxy {
    const sampler: HTTPSamplerProxy = {
      id: this.generateId(),
      type: 'HTTPSamplerProxy',
      testClass: 'HTTPSamplerProxy',
      guiClass: this.getStringValue(xml.guiclass) || 'HttpTestSampleGui',
      name: this.getStringValue(xml.testname) || 'HTTP Request',
      enabled: this.getStringValue(xml.enabled) !== 'false',
      comments: this.parseStringProp(xml, 'TestPlan.comments'),
      domain: this.parseStringProp(xml, 'HTTPSampler.domain') || '',
      port: this.parseIntProp(xml, 'HTTPSampler.port'),
      protocol: this.parseStringProp(xml, 'HTTPSampler.protocol') as any || 'https',
      path: this.parseStringProp(xml, 'HTTPSampler.path') || '/',
      method: this.parseStringProp(xml, 'HTTPSampler.method') as any || 'GET',
      followRedirects: this.parseBoolProp(xml, 'HTTPSampler.follow_redirects'),
      useKeepAlive: this.parseBoolProp(xml, 'HTTPSampler.use_keepalive'),
      postBodyRaw: this.parseBoolProp(xml, 'HTTPSampler.postBodyRaw'),
      bodyData: this.parseBodyData(xml),
      concurrentPool: this.parseIntProp(xml, 'HTTPSampler.concurrentPool'),
      implementation: this.parseStringProp(xml, 'HTTPSampler.implementation'),
      arguments: this.parseHTTPArguments(xml),
      children: []
    };

    if (childHashTree) {
      sampler.children = this.parseHashTree(childHashTree);
    }

    return sampler;
  }

  private parseRegexExtractor(xml: any): RegexExtractor {
    return {
      id: this.generateId(),
      type: 'RegexExtractor',
      testClass: 'RegexExtractor',
      guiClass: this.getStringValue(xml.guiclass) || 'RegexExtractorGui',
      name: this.getStringValue(xml.testname) || 'Regular Expression Extractor',
      enabled: this.getStringValue(xml.enabled) !== 'false',
      refName: this.parseStringProp(xml, 'RegexExtractor.refname') || '',
      regex: this.parseStringProp(xml, 'RegexExtractor.regex') || '',
      template: this.parseStringProp(xml, 'RegexExtractor.template') || '$1$',
      defaultValue: this.parseStringProp(xml, 'RegexExtractor.default') || '',
      matchNumber: this.parseIntOrStringProp(xml, 'RegexExtractor.match_number') || 1,
      useHeaders: this.parseBoolProp(xml, 'RegexExtractor.useHeaders'),
      defaultEmptyValue: this.parseBoolProp(xml, 'RegexExtractor.default_empty_value'),
      scope: this.parseStringProp(xml, 'Sample.scope') as any,
      children: []
    };
  }

  private parseResponseAssertion(xml: any): ResponseAssertion {
    const testStrings = this.parseCollectionProp(xml, 'Asserion.test_strings');
    
    return {
      id: this.generateId(),
      type: 'ResponseAssertion',
      testClass: 'ResponseAssertion',
      guiClass: this.getStringValue(xml.guiclass) || 'AssertionGui',
      name: this.getStringValue(xml.testname) || 'Response Assertion',
      enabled: this.getStringValue(xml.enabled) !== 'false',
      testField: this.parseStringProp(xml, 'Assertion.test_field') as any || 'response_data',
      testType: this.parseIntProp(xml, 'Assertion.test_type') || 2,
      testStrings,
      assumeSuccess: this.parseBoolProp(xml, 'Assertion.assume_success'),
      customMessage: this.parseStringProp(xml, 'Assertion.custom_message'),
      children: []
    };
  }

  private parseHeaderManager(xml: any): HeaderManager {
    const headers: Header[] = [];
    const headersProp = xml.collectionProp?.find((p: any) => {
      const propName = this.getStringValue(p.name);
      return propName === 'HeaderManager.headers';
    });
    
    if (headersProp?.elementProp) {
      for (const elem of headersProp.elementProp) {
        const name = this.findStringProp(elem, 'Header.name');
        const value = this.findStringProp(elem, 'Header.value');
        if (name || value) {
          headers.push({ name: name || '', value: value || '' });
        }
      }
    }

    return {
      id: this.generateId(),
      type: 'HeaderManager',
      testClass: 'HeaderManager',
      guiClass: this.getStringValue(xml.guiclass) || 'HeaderPanel',
      name: this.getStringValue(xml.testname) || 'HTTP Header Manager',
      enabled: this.getStringValue(xml.enabled) !== 'false',
      headers,
      children: []
    };
  }

  private parseArguments(xml: any): BaseElement {
    return {
      id: this.generateId(),
      type: 'Arguments',
      testClass: 'Arguments',
      guiClass: this.getStringValue(xml.guiclass) || 'ArgumentsPanel',
      name: this.getStringValue(xml.testname) || 'User Defined Variables',
      enabled: this.getStringValue(xml.enabled) !== 'false',
      children: []
    };
  }

  private parseJSR223Sampler(xml: any, childHashTree: any): BaseElement {
    return {
      id: this.generateId(),
      type: 'JSR223Sampler',
      testClass: 'JSR223Sampler',
      guiClass: this.getStringValue(xml.guiclass) || 'TestBeanGUI',
      name: this.getStringValue(xml.testname) || 'JSR223 Sampler',
      enabled: this.getStringValue(xml.enabled) !== 'false',
      children: []
    };
  }

  private parseJSR223PostProcessor(xml: any): BaseElement {
    return {
      id: this.generateId(),
      type: 'JSR223PostProcessor',
      testClass: 'JSR223PostProcessor',
      guiClass: this.getStringValue(xml.guiclass) || 'TestBeanGUI',
      name: this.getStringValue(xml.testname) || 'JSR223 PostProcessor',
      enabled: this.getStringValue(xml.enabled) !== 'false',
      children: []
    };
  }

  private parseBeanShellAssertion(xml: any): BeanShellAssertion {
    return {
      id: this.generateId(),
      type: 'BeanShellAssertion',
      testClass: 'BeanShellAssertion',
      guiClass: this.getStringValue(xml.guiclass) || 'BeanShellAssertionGui',
      name: this.getStringValue(xml.testname) || 'BeanShell Assertion',
      enabled: this.getStringValue(xml.enabled) !== 'false',
      query: this.parseStringProp(xml, 'BeanShellAssertion.query') || '',
      filename: this.parseStringProp(xml, 'BeanShellAssertion.filename'),
      parameters: this.parseStringProp(xml, 'BeanShellAssertion.parameters'),
      resetInterpreter: this.parseBoolProp(xml, 'BeanShellAssertion.resetInterpreter'),
      children: []
    };
  }

  private parseResultCollector(xml: any): ResultCollector {
    return {
      id: this.generateId(),
      type: 'ResultCollector',
      testClass: 'ResultCollector',
      guiClass: this.getStringValue(xml.guiclass) || 'ViewResultsFullVisualizer',
      name: this.getStringValue(xml.testname) || 'View Results Tree',
      enabled: this.getStringValue(xml.enabled) !== 'false',
      errorLogging: this.parseBoolProp(xml, 'ResultCollector.error_logging'),
      children: []
    };
  }

  private parseTestAction(xml: any, childHashTree: any): BaseElement {
    return {
      id: this.generateId(),
      type: 'TestAction',
      testClass: 'TestAction',
      guiClass: this.getStringValue(xml.guiclass) || 'TestActionGui',
      name: this.getStringValue(xml.testname) || 'Test Action',
      enabled: this.getStringValue(xml.enabled) !== 'false',
      children: childHashTree ? this.parseHashTree(childHashTree) : []
    };
  }

  private parseLoopController(xml: any): LoopController {
    const loopControllerProp = xml.elementProp?.find((p: any) => {
      const elementType = this.getStringValue(p.elementType);
      return elementType === 'LoopController';
    });
    
    if (loopControllerProp) {
      return {
        loops: this.parseIntOrStringProp(loopControllerProp, 'LoopController.loops') || 1,
        continueForever: this.parseBoolProp(loopControllerProp, 'LoopController.continue_forever')
      };
    }

    return { loops: 1, continueForever: false };
  }

  private parseUserDefinedVariables(xml: any): Argument[] {
    const args: Argument[] = [];
    const argsProp = xml.elementProp?.find((p: any) => {
      const propName = this.getStringValue(p.name);
      return propName === 'TestPlan.user_defined_variables';
    });
    
    if (argsProp?.collectionProp) {
      const collection = argsProp.collectionProp.find((c: any) => {
        const collName = this.getStringValue(c.name);
        return collName === 'Arguments.arguments';
      });
      if (collection?.elementProp) {
        for (const elem of collection.elementProp) {
          args.push({
            name: this.findStringProp(elem, 'Argument.name') || '',
            value: this.findStringProp(elem, 'Argument.value') || '',
            metadata: this.findStringProp(elem, 'Argument.metadata')
          });
        }
      }
    }

    return args;
  }

  private parseBodyData(xml: any): string | undefined {
    const argsProp = xml.elementProp?.find((p: any) => {
      const propName = this.getStringValue(p.name);
      return propName === 'HTTPsampler.Arguments';
    });
    
    if (argsProp?.collectionProp) {
      const collection = argsProp.collectionProp.find((c: any) => {
        const collName = this.getStringValue(c.name);
        return collName === 'Arguments.arguments';
      });
      if (collection?.elementProp?.[0]) {
        const value = this.findStringProp(collection.elementProp[0], 'Argument.value');
        return value;
      }
    }
    return undefined;
  }

  private parseHTTPArguments(xml: any): HTTPArgument[] {
    const args: HTTPArgument[] = [];
    const argsProp = xml.elementProp?.find((p: any) => {
      const propName = this.getStringValue(p.name);
      return propName === 'HTTPsampler.Arguments';
    });
    
    if (argsProp?.collectionProp) {
      const collection = argsProp.collectionProp.find((c: any) => {
        const collName = this.getStringValue(c.name);
        return collName === 'Arguments.arguments';
      });
      if (collection?.elementProp) {
        for (const elem of collection.elementProp) {
          args.push({
            name: this.findStringProp(elem, 'Argument.name') || '',
            value: this.findStringProp(elem, 'Argument.value') || '',
            metadata: this.findStringProp(elem, 'Argument.metadata') || '',
            alwaysEncode: this.findBoolProp(elem, 'HTTPArgument.always_encode')
          });
        }
      }
    }

    return args;
  }

  private parseStringProp(xml: any, name: string): string | undefined {
    const prop = xml.stringProp?.find((p: any) => {
      const propName = this.getStringValue(p.name);
      return propName === name;
    });
    if (!prop) return undefined;
    const val = prop._;
    return this.getStringValue(val);
  }

  private parseIntProp(xml: any, name: string): number | undefined {
    const prop = xml.intProp?.find((p: any) => {
      const propName = this.getStringValue(p.name);
      return propName === name;
    });
    if (!prop) return undefined;
    const value = this.getStringValue(prop._);
    return value ? parseInt(value, 10) : undefined;
  }

  private parseBoolProp(xml: any, name: string): boolean {
    const prop = xml.boolProp?.find((p: any) => {
      const propName = this.getStringValue(p.name);
      return propName === name;
    });
    if (!prop) return false;
    const value = this.getStringValue(prop._);
    return value === 'true';
  }

  private parseIntOrStringProp(xml: any, name: string): number | string | undefined {
    const intVal = this.parseIntProp(xml, name);
    if (intVal !== undefined) return intVal;
    
    const strVal = this.parseStringProp(xml, name);
    if (strVal && strVal.includes('${')) return strVal;
    if (strVal) return parseInt(strVal, 10) || strVal;
    
    return undefined;
  }

  private parseCollectionProp(xml: any, name: string): string[] {
    const collection = xml.collectionProp?.find((p: any) => {
      const propName = this.getStringValue(p.name);
      return propName === name;
    });
    if (!collection?.stringProp) return [];
    
    return collection.stringProp.map((p: any) => this.getStringValue(p._) || '');
  }

  private findStringProp(elem: any, name: string): string | undefined {
    const prop = elem.stringProp?.find((p: any) => {
      const propName = this.getStringValue(p.name);
      return propName === name;
    });
    if (!prop) return undefined;
    return this.getStringValue(prop._);
  }

  private findBoolProp(elem: any, name: string): boolean {
    const prop = elem.boolProp?.find((p: any) => {
      const propName = this.getStringValue(p.name);
      return propName === name;
    });
    if (!prop) return false;
    const value = this.getStringValue(prop._);
    return value === 'true';
  }

  private parseConstantThroughputTimer(xml: any): BaseElement {
    return {
      id: this.generateId(),
      type: 'ConstantThroughputTimer',
      testClass: 'ConstantThroughputTimer',
      guiClass: this.getStringValue(xml.guiclass) || 'TestBeanGUI',
      name: this.getStringValue(xml.testname) || 'Constant Throughput Timer',
      enabled: this.getStringValue(xml.enabled) !== 'false',
      children: []
    };
  }

  private generateId(): string {
    return `jmeter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
