import { create } from 'xmlbuilder2';
import {
  JMeterTestPlan,
  TestPlan,
  ThreadGroup,
  HTTPSamplerProxy,
  BaseElement,
  RegexExtractor,
  ResponseAssertion,
  HeaderManager,
  BeanShellAssertion,
  isThreadGroup,
  isHTTPSampler
} from '../model/types';

export class JMXSerializer {
  serialize(testPlan: JMeterTestPlan): string {
    const root = create({ version: '1.0', encoding: 'UTF-8' })
      .ele('jmeterTestPlan', {
        version: testPlan.version,
        properties: testPlan.properties,
        jmeter: testPlan.jmeter
      });

    const mainHashTree = root.ele('hashTree');
    this.serializeTestPlan(mainHashTree, testPlan.testPlan);

    return root.end({ prettyPrint: true, indent: '  ' });
  }

  private serializeTestPlan(parent: any, testPlan: TestPlan): void {
    const testPlanElem = parent.ele('TestPlan', {
      guiclass: testPlan.guiClass,
      testclass: testPlan.testClass,
      testname: testPlan.name
    });

    const userVarsElem = testPlanElem.ele('elementProp', {
      name: 'TestPlan.user_defined_variables',
      elementType: 'Arguments',
      guiclass: 'ArgumentsPanel',
      testclass: 'Arguments',
      testname: 'User Defined Variables'
    });

    const argsCollection = userVarsElem.ele('collectionProp', { name: 'Arguments.arguments' });
    
    for (const arg of testPlan.userDefinedVariables) {
      const argElem = argsCollection.ele('elementProp', {
        name: arg.name,
        elementType: 'Argument'
      });
      argElem.ele('stringProp', { name: 'Argument.name' }).txt(arg.name);
      argElem.ele('stringProp', { name: 'Argument.value' }).txt(arg.value);
      if (arg.metadata) {
        argElem.ele('stringProp', { name: 'Argument.metadata' }).txt(arg.metadata);
      }
    }

    testPlanElem.ele('boolProp', { name: 'TestPlan.functional_mode' }).txt(testPlan.functionalMode.toString());
    testPlanElem.ele('boolProp', { name: 'TestPlan.serialize_threadgroups' }).txt(testPlan.serializeThreadGroups.toString());

    const childHashTree = parent.ele('hashTree');
    this.serializeChildren(childHashTree, testPlan.children);
  }

  private serializeChildren(parent: any, children: BaseElement[]): void {
    for (const child of children) {
      this.serializeElement(parent, child);
      const childHashTree = parent.ele('hashTree');
      if (child.children && child.children.length > 0) {
        this.serializeChildren(childHashTree, child.children);
      }
    }
  }

  private serializeElement(parent: any, element: BaseElement): void {
    switch (element.type) {
      case 'ThreadGroup':
      case 'SetupThreadGroup':
      case 'PostThreadGroup':
        this.serializeThreadGroup(parent, element as ThreadGroup);
        break;
      case 'HTTPSamplerProxy':
        this.serializeHTTPSampler(parent, element as HTTPSamplerProxy);
        break;
      case 'RegexExtractor':
        this.serializeRegexExtractor(parent, element as RegexExtractor);
        break;
      case 'ResponseAssertion':
        this.serializeResponseAssertion(parent, element as ResponseAssertion);
        break;
      case 'HeaderManager':
        this.serializeHeaderManager(parent, element as HeaderManager);
        break;
      case 'BeanShellAssertion':
        this.serializeBeanShellAssertion(parent, element as BeanShellAssertion);
        break;
      case 'Arguments':
        this.serializeArguments(parent, element);
        break;
      case 'JSR223Sampler':
      case 'JSR223PostProcessor':
        this.serializeJSR223Element(parent, element);
        break;
      case 'ResultCollector':
        this.serializeResultCollector(parent, element);
        break;
      case 'TestAction':
        this.serializeTestAction(parent, element);
        break;
      case 'ConstantThroughputTimer':
        this.serializeConstantThroughputTimer(parent, element);
        break;
    }
  }

  private serializeThreadGroup(parent: any, tg: ThreadGroup): void {
    const elem = parent.ele(tg.type, {
      guiclass: tg.guiClass,
      testclass: tg.testClass,
      testname: tg.name,
      enabled: tg.enabled.toString()
    });

    if (tg.comments) {
      elem.ele('stringProp', { name: 'TestPlan.comments' }).txt(tg.comments);
    }

    this.addProp(elem, 'intProp', 'ThreadGroup.num_threads', tg.numThreads);
    this.addProp(elem, 'intProp', 'ThreadGroup.ramp_time', tg.rampTime);
    
    if (tg.duration !== undefined) {
      this.addProp(elem, 'stringProp', 'ThreadGroup.duration', tg.duration);
    }
    if (tg.delay !== undefined) {
      this.addProp(elem, 'stringProp', 'ThreadGroup.delay', tg.delay);
    }

    elem.ele('boolProp', { name: 'ThreadGroup.same_user_on_next_iteration' }).txt(tg.sameUserOnNextIteration.toString());
    elem.ele('boolProp', { name: 'ThreadGroup.scheduler' }).txt(tg.scheduler.toString());
    elem.ele('stringProp', { name: 'ThreadGroup.on_sample_error' }).txt(tg.onSampleError);

    const loopElem = elem.ele('elementProp', {
      name: 'ThreadGroup.main_controller',
      elementType: 'LoopController',
      guiclass: 'LoopControlPanel',
      testclass: 'LoopController',
      testname: 'Loop Controller'
    });

    this.addProp(loopElem, 'intProp', 'LoopController.loops', tg.loopController.loops);
    loopElem.ele('boolProp', { name: 'LoopController.continue_forever' }).txt(tg.loopController.continueForever.toString());
  }

  private serializeHTTPSampler(parent: any, sampler: HTTPSamplerProxy): void {
    const elem = parent.ele('HTTPSamplerProxy', {
      guiclass: sampler.guiClass,
      testclass: sampler.testClass,
      testname: sampler.name,
      enabled: sampler.enabled.toString()
    });

    if (sampler.comments) {
      elem.ele('stringProp', { name: 'TestPlan.comments' }).txt(sampler.comments);
    }

    if (sampler.concurrentPool) {
      elem.ele('intProp', { name: 'HTTPSampler.concurrentPool' }).txt(sampler.concurrentPool.toString());
    }

    elem.ele('stringProp', { name: 'HTTPSampler.domain' }).txt(sampler.domain);
    elem.ele('stringProp', { name: 'HTTPSampler.protocol' }).txt(sampler.protocol);
    elem.ele('stringProp', { name: 'HTTPSampler.path' }).txt(sampler.path);
    elem.ele('boolProp', { name: 'HTTPSampler.follow_redirects' }).txt(sampler.followRedirects.toString());
    elem.ele('stringProp', { name: 'HTTPSampler.method' }).txt(sampler.method);
    elem.ele('boolProp', { name: 'HTTPSampler.use_keepalive' }).txt(sampler.useKeepAlive.toString());
    elem.ele('boolProp', { name: 'HTTPSampler.postBodyRaw' }).txt(sampler.postBodyRaw.toString());

    if (sampler.port) {
      elem.ele('intProp', { name: 'HTTPSampler.port' }).txt(sampler.port.toString());
    }
    if (sampler.implementation) {
      elem.ele('stringProp', { name: 'HTTPSampler.implementation' }).txt(sampler.implementation);
    }

    const argsElem = elem.ele('elementProp', {
      name: 'HTTPsampler.Arguments',
      elementType: 'Arguments'
    });

    const argsCollection = argsElem.ele('collectionProp', { name: 'Arguments.arguments' });
    for (const arg of sampler.arguments) {
      const argElem = argsCollection.ele('elementProp', { name: arg.name || '', elementType: 'HTTPArgument' });
      argElem.ele('boolProp', { name: 'HTTPArgument.always_encode' }).txt(arg.alwaysEncode.toString());
      argElem.ele('stringProp', { name: 'Argument.value' }).txt(arg.value);
      argElem.ele('stringProp', { name: 'Argument.metadata' }).txt(arg.metadata);
    }
  }

  private serializeRegexExtractor(parent: any, extractor: RegexExtractor): void {
    const elem = parent.ele('RegexExtractor', {
      guiclass: extractor.guiClass,
      testclass: extractor.testClass,
      testname: extractor.name,
      enabled: extractor.enabled.toString()
    });

    elem.ele('boolProp', { name: 'RegexExtractor.useHeaders' }).txt(extractor.useHeaders.toString());
    elem.ele('stringProp', { name: 'RegexExtractor.refname' }).txt(extractor.refName);
    elem.ele('stringProp', { name: 'RegexExtractor.regex' }).txt(extractor.regex);
    elem.ele('stringProp', { name: 'RegexExtractor.template' }).txt(extractor.template);
    elem.ele('stringProp', { name: 'RegexExtractor.default' }).txt(extractor.defaultValue);
    this.addProp(elem, 'intProp', 'RegexExtractor.match_number', extractor.matchNumber);
    elem.ele('boolProp', { name: 'RegexExtractor.default_empty_value' }).txt(extractor.defaultEmptyValue.toString());
    
    if (extractor.scope) {
      elem.ele('stringProp', { name: 'Sample.scope' }).txt(extractor.scope);
    }
  }

  private serializeResponseAssertion(parent: any, assertion: ResponseAssertion): void {
    const elem = parent.ele('ResponseAssertion', {
      guiclass: assertion.guiClass,
      testclass: assertion.testClass,
      testname: assertion.name,
      enabled: assertion.enabled.toString()
    });

    const collection = elem.ele('collectionProp', { name: 'Asserion.test_strings' });
    for (const str of assertion.testStrings) {
      collection.ele('stringProp', { name: str.substring(0, 10) }).txt(str);
    }

    if (assertion.customMessage) {
      elem.ele('stringProp', { name: 'Assertion.custom_message' }).txt(assertion.customMessage);
    }
    elem.ele('stringProp', { name: 'Assertion.test_field' }).txt(assertion.testField);
    elem.ele('boolProp', { name: 'Assertion.assume_success' }).txt(assertion.assumeSuccess.toString());
    elem.ele('intProp', { name: 'Assertion.test_type' }).txt(assertion.testType.toString());
  }

  private serializeHeaderManager(parent: any, manager: HeaderManager): void {
    const elem = parent.ele('HeaderManager', {
      guiclass: manager.guiClass,
      testclass: manager.testClass,
      testname: manager.name,
      enabled: manager.enabled.toString()
    });

    if (manager.comments) {
      elem.ele('stringProp', { name: 'TestPlan.comments' }).txt(manager.comments);
    }

    const collection = elem.ele('collectionProp', { name: 'HeaderManager.headers' });
    for (const header of manager.headers) {
      const headerElem = collection.ele('elementProp', { name: header.name || '', elementType: 'Header' });
      headerElem.ele('stringProp', { name: 'Header.name' }).txt(header.name);
      headerElem.ele('stringProp', { name: 'Header.value' }).txt(header.value);
    }
  }

  private serializeBeanShellAssertion(parent: any, assertion: BeanShellAssertion): void {
    const elem = parent.ele('BeanShellAssertion', {
      guiclass: assertion.guiClass,
      testclass: assertion.testClass,
      testname: assertion.name,
      enabled: assertion.enabled.toString()
    });

    elem.ele('stringProp', { name: 'BeanShellAssertion.query' }).txt(assertion.query);
    if (assertion.filename) {
      elem.ele('stringProp', { name: 'BeanShellAssertion.filename' }).txt(assertion.filename);
    }
    if (assertion.parameters) {
      elem.ele('stringProp', { name: 'BeanShellAssertion.parameters' }).txt(assertion.parameters);
    }
    elem.ele('boolProp', { name: 'BeanShellAssertion.resetInterpreter' }).txt(assertion.resetInterpreter.toString());
  }

  private serializeArguments(parent: any, element: BaseElement): void {
    const elem = parent.ele('Arguments', {
      guiclass: element.guiClass,
      testclass: element.testClass,
      testname: element.name,
      enabled: element.enabled.toString()
    });

    elem.ele('collectionProp', { name: 'Arguments.arguments' });
  }

  private serializeJSR223Element(parent: any, element: BaseElement): void {
    const elem = parent.ele(element.type, {
      guiclass: element.guiClass,
      testclass: element.testClass,
      testname: element.name,
      enabled: element.enabled.toString()
    });

    elem.ele('stringProp', { name: 'scriptLanguage' }).txt('groovy');
    elem.ele('stringProp', { name: 'parameters' }).txt('');
    elem.ele('stringProp', { name: 'filename' }).txt('');
    elem.ele('stringProp', { name: 'cacheKey' }).txt('true');
    elem.ele('stringProp', { name: 'script' }).txt('');
  }

  private serializeResultCollector(parent: any, element: BaseElement): void {
    const elem = parent.ele('ResultCollector', {
      guiclass: element.guiClass,
      testclass: element.testClass,
      testname: element.name,
      enabled: element.enabled.toString()
    });

    elem.ele('boolProp', { name: 'ResultCollector.error_logging' }).txt('false');
    elem.ele('stringProp', { name: 'filename' }).txt('');
  }

  private serializeTestAction(parent: any, element: BaseElement): void {
    const elem = parent.ele('TestAction', {
      guiclass: element.guiClass,
      testclass: element.testClass,
      testname: element.name,
      enabled: element.enabled.toString()
    });

    elem.ele('intProp', { name: 'ActionProcessor.action' }).txt('1');
    elem.ele('intProp', { name: 'ActionProcessor.target' }).txt('0');
    elem.ele('stringProp', { name: 'ActionProcessor.duration' }).txt('0');
  }

  private serializeConstantThroughputTimer(parent: any, element: BaseElement): void {
    const elem = parent.ele('ConstantThroughputTimer', {
      guiclass: element.guiClass,
      testclass: element.testClass,
      testname: element.name,
      enabled: element.enabled.toString()
    });

    elem.ele('intProp', { name: 'calcMode' }).txt('0');
    elem.ele('stringProp', { name: 'throughput' }).txt('0');
  }

  private addProp(parent: any, propType: string, name: string, value: any): void {
    const strValue = typeof value === 'string' ? value : value.toString();
    parent.ele(propType, { name }).txt(strValue);
  }
}
