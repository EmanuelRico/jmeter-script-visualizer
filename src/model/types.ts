/**
 * Core type definitions for JMeter domain model
 * These types represent JMeter concepts, not XML structure
 */

export type ElementType =
  | 'TestPlan'
  | 'ThreadGroup'
  | 'SetupThreadGroup'
  | 'PostThreadGroup'
  | 'HTTPSamplerProxy'
  | 'JSR223Sampler'
  | 'JSR223PreProcessor'
  | 'Arguments'
  | 'HeaderManager'
  | 'RegexExtractor'
  | 'JSONExtractor'
  | 'XPathExtractor'
  | 'BoundaryExtractor'
  | 'ResponseAssertion'
  | 'JSONAssertion'
  | 'XPathAssertion'
  | 'DurationAssertion'
  | 'SizeAssertion'
  | 'BeanShellAssertion'
  | 'JSR223PostProcessor'
  | 'ResultCollector'
  | 'SummaryReport'
  | 'AggregateReport'
  | 'ViewResultsTree'
  | 'SimpleDataWriter'
  | 'BackendListener'
  | 'LoopController'
  | 'IfController'
  | 'WhileController'
  | 'ForeachController'
  | 'TransactionController'
  | 'TestAction'
  | 'ConstantTimer'
  | 'UniformRandomTimer'
  | 'GaussianRandomTimer'
  | 'ConstantThroughputTimer'
  | 'CSVDataSet'
  | 'UserDefinedVariables'
  | 'CookieManager'
  | 'CacheManager'
  | 'AuthManager'
  | 'Counter';

export interface BaseElement {
  id: string;
  type: ElementType;
  testClass: string;
  guiClass: string;
  name: string;
  enabled: boolean;
  comments?: string;
  children: BaseElement[];
}

export interface Property {
  name: string;
  value: string | number | boolean;
  type: 'string' | 'int' | 'bool' | 'long';
}

export interface TestPlan extends BaseElement {
  type: 'TestPlan';
  functionalMode: boolean;
  serializeThreadGroups: boolean;
  userDefinedVariables: Argument[];
}

export interface ThreadGroup extends BaseElement {
  type: 'ThreadGroup' | 'SetupThreadGroup' | 'PostThreadGroup';
  numThreads: number | string;
  rampTime: number | string;
  duration?: number | string;
  delay?: number | string;
  scheduler: boolean;
  sameUserOnNextIteration: boolean;
  onSampleError: 'continue' | 'startnextloop' | 'stopthread' | 'stoptest';
  loopController: LoopController;
}

export interface LoopController {
  loops: number | string;
  continueForever: boolean;
}

export interface HTTPSamplerProxy extends BaseElement {
  type: 'HTTPSamplerProxy';
  domain: string;
  port?: number;
  protocol: 'http' | 'https';
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
  followRedirects: boolean;
  useKeepAlive: boolean;
  postBodyRaw: boolean;
  bodyData?: string;
  arguments: HTTPArgument[];
  concurrentPool?: number;
  implementation?: string;
}

export interface HTTPArgument {
  name: string;
  value: string;
  metadata: string;
  alwaysEncode: boolean;
}

export interface Argument {
  name: string;
  value: string;
  metadata?: string;
}

export interface HeaderManager extends BaseElement {
  type: 'HeaderManager';
  headers: Header[];
}

export interface Header {
  name: string;
  value: string;
}

export interface RegexExtractor extends BaseElement {
  type: 'RegexExtractor';
  refName: string;
  regex: string;
  template: string;
  defaultValue: string;
  matchNumber: number | string;
  useHeaders: boolean;
  defaultEmptyValue: boolean;
  scope?: 'all' | 'parent' | 'children';
}

export interface JSONExtractor extends BaseElement {
  type: 'JSONExtractor';
  refName: string;
  jsonPath: string;
  defaultValue: string;
  matchNumber: number | string;
}

export interface XPathExtractor extends BaseElement {
  type: 'XPathExtractor';
  refName: string;
  xpathQuery: string;
  defaultValue: string;
  matchNumber: number | string;
}

export interface BoundaryExtractor extends BaseElement {
  type: 'BoundaryExtractor';
  refName: string;
  leftBoundary: string;
  rightBoundary: string;
  defaultValue: string;
  matchNumber: number | string;
}

export interface ResponseAssertion extends BaseElement {
  type: 'ResponseAssertion';
  testField: 'response_data' | 'response_code' | 'response_message' | 'response_headers';
  testType: number;
  testStrings: string[];
  assumeSuccess: boolean;
  customMessage?: string;
}

export interface JSR223Sampler extends BaseElement {
  type: 'JSR223Sampler';
  scriptLanguage: 'groovy' | 'javascript' | 'beanshell';
  script: string;
  parameters?: string;
  filename?: string;
  cacheKey?: string;
}

export interface JSR223PreProcessor extends BaseElement {
  type: 'JSR223PreProcessor';
  scriptLanguage: 'groovy' | 'javascript' | 'beanshell';
  script: string;
  parameters?: string;
  filename?: string;
  cacheKey?: string;
}

export interface JSR223PostProcessor extends BaseElement {
  type: 'JSR223PostProcessor';
  scriptLanguage: 'groovy' | 'javascript' | 'beanshell';
  script: string;
  parameters?: string;
  filename?: string;
  cacheKey?: string;
}

export interface JSONAssertion extends BaseElement {
  type: 'JSONAssertion';
  jsonPath: string;
  expectedValue: string;
  expectNull: boolean;
  invert: boolean;
}

export interface XPathAssertion extends BaseElement {
  type: 'XPathAssertion';
  xpathQuery: string;
  validate: boolean;
  tolerant: boolean;
  ignoreWhitespace: boolean;
}

export interface DurationAssertion extends BaseElement {
  type: 'DurationAssertion';
  allowedDuration: number | string;
}

export interface SizeAssertion extends BaseElement {
  type: 'SizeAssertion';
  size: number | string;
  operator: 1 | 2 | 3 | 4 | 5 | 6;
}

export interface BeanShellAssertion extends BaseElement {
  type: 'BeanShellAssertion';
  query: string;
  filename?: string;
  parameters?: string;
  resetInterpreter: boolean;
}

export interface ResultCollector extends BaseElement {
  type: 'ResultCollector' | 'SummaryReport' | 'AggregateReport' | 'ViewResultsTree' | 'SimpleDataWriter';
  errorLogging: boolean;
  filename?: string;
}

export interface BackendListener extends BaseElement {
  type: 'BackendListener';
  classname: string;
  queueSize: number | string;
  arguments: Argument[];
}

export interface TestAction extends BaseElement {
  type: 'TestAction';
  action: 0 | 1 | 2;
  target: 0 | 1 | 2;
  duration: number | string;
}

export interface IfController extends BaseElement {
  type: 'IfController';
  condition: string;
  evaluateAll: boolean;
  useExpression: boolean;
}

export interface WhileController extends BaseElement {
  type: 'WhileController';
  condition: string;
}

export interface ForeachController extends BaseElement {
  type: 'ForeachController';
  inputVariable: string;
  returnVariable: string;
  useSeparator: boolean;
}

export interface TransactionController extends BaseElement {
  type: 'TransactionController';
  parent: boolean;
  includeTimers: boolean;
}

export interface ConstantTimer extends BaseElement {
  type: 'ConstantTimer';
  delay: number | string;
}

export interface UniformRandomTimer extends BaseElement {
  type: 'UniformRandomTimer';
  delay: number | string;
  range: number | string;
}

export interface GaussianRandomTimer extends BaseElement {
  type: 'GaussianRandomTimer';
  delay: number | string;
  range: number | string;
}

export interface ConstantThroughputTimer extends BaseElement {
  type: 'ConstantThroughputTimer';
  throughput: number | string;
  calcMode: 0 | 1 | 2 | 3 | 4;
}

export interface CSVDataSet extends BaseElement {
  type: 'CSVDataSet';
  filename: string;
  fileEncoding: string;
  variableNames: string;
  delimiter: string;
  recycle: boolean;
  stopThread: boolean;
  shareMode: 'shareMode.all' | 'shareMode.group' | 'shareMode.thread';
}

export interface UserDefinedVariables extends BaseElement {
  type: 'UserDefinedVariables';
  variables: Argument[];
}

export interface CookieManager extends BaseElement {
  type: 'CookieManager';
  clearEachIteration: boolean;
  controlledByThread: boolean;
}

export interface CacheManager extends BaseElement {
  type: 'CacheManager';
  clearEachIteration: boolean;
  useExpires: boolean;
}

export interface AuthManager extends BaseElement {
  type: 'AuthManager';
  authorizations: Authorization[];
}

export interface Authorization {
  url: string;
  username: string;
  password: string;
  domain: string;
  realm: string;
  mechanism: string;
}

export interface Counter extends BaseElement {
  type: 'Counter';
  start: number | string;
  increment: number | string;
  maximum: number | string;
  format: string;
  referenceName: string;
  perUser: boolean;
  resetOnThreadGroupIteration: boolean;
}

export interface JMeterTestPlan {
  version: string;
  properties: string;
  jmeter: string;
  testPlan: TestPlan;
}

export function isThreadGroup(element: BaseElement): element is ThreadGroup {
  return element.type === 'ThreadGroup' || 
         element.type === 'SetupThreadGroup' || 
         element.type === 'PostThreadGroup';
}

export function isHTTPSampler(element: BaseElement): element is HTTPSamplerProxy {
  return element.type === 'HTTPSamplerProxy';
}

export const ELEMENT_HIERARCHY: Record<ElementType, ElementType[]> = {
  TestPlan: ['ThreadGroup', 'SetupThreadGroup', 'PostThreadGroup', 'Arguments', 'HeaderManager', 'ResultCollector', 'SummaryReport', 'AggregateReport', 'ViewResultsTree', 'SimpleDataWriter', 'BackendListener', 'UserDefinedVariables', 'CookieManager', 'CacheManager', 'AuthManager'],
  ThreadGroup: ['HTTPSamplerProxy', 'JSR223Sampler', 'TestAction', 'IfController', 'WhileController', 'ForeachController', 'TransactionController', 'LoopController', 'ConstantTimer', 'UniformRandomTimer', 'GaussianRandomTimer', 'ConstantThroughputTimer', 'CSVDataSet', 'Counter'],
  SetupThreadGroup: ['HTTPSamplerProxy', 'JSR223Sampler', 'TestAction'],
  PostThreadGroup: ['HTTPSamplerProxy', 'JSR223Sampler', 'TestAction'],
  HTTPSamplerProxy: ['HeaderManager', 'RegexExtractor', 'JSONExtractor', 'XPathExtractor', 'BoundaryExtractor', 'ResponseAssertion', 'JSONAssertion', 'XPathAssertion', 'DurationAssertion', 'SizeAssertion', 'BeanShellAssertion', 'JSR223PreProcessor', 'JSR223PostProcessor'],
  JSR223Sampler: ['RegexExtractor', 'ResponseAssertion'],
  JSR223PreProcessor: [],
  Arguments: [],
  HeaderManager: [],
  RegexExtractor: [],
  JSONExtractor: [],
  XPathExtractor: [],
  BoundaryExtractor: [],
  ResponseAssertion: [],
  JSONAssertion: [],
  XPathAssertion: [],
  DurationAssertion: [],
  SizeAssertion: [],
  BeanShellAssertion: [],
  JSR223PostProcessor: [],
  ResultCollector: [],
  SummaryReport: [],
  AggregateReport: [],
  ViewResultsTree: [],
  SimpleDataWriter: [],
  BackendListener: [],
  LoopController: ['HTTPSamplerProxy', 'JSR223Sampler'],
  IfController: ['HTTPSamplerProxy', 'JSR223Sampler'],
  WhileController: ['HTTPSamplerProxy', 'JSR223Sampler'],
  ForeachController: ['HTTPSamplerProxy', 'JSR223Sampler'],
  TransactionController: ['HTTPSamplerProxy', 'JSR223Sampler'],
  TestAction: ['ConstantThroughputTimer'],
  ConstantTimer: [],
  UniformRandomTimer: [],
  GaussianRandomTimer: [],
  ConstantThroughputTimer: [],
  CSVDataSet: [],
  UserDefinedVariables: [],
  CookieManager: [],
  CacheManager: [],
  AuthManager: [],
  Counter: []
};

export function createHTTPSampler(name: string): HTTPSamplerProxy {
  return {
    id: generateId(),
    type: 'HTTPSamplerProxy',
    testClass: 'HTTPSamplerProxy',
    guiClass: 'HttpTestSampleGui',
    name,
    enabled: true,
    domain: '',
    protocol: 'https',
    path: '/',
    method: 'GET',
    followRedirects: true,
    useKeepAlive: true,
    postBodyRaw: false,
    arguments: [],
    children: []
  };
}

export function createThreadGroup(name: string): ThreadGroup {
  return {
    id: generateId(),
    type: 'ThreadGroup',
    testClass: 'ThreadGroup',
    guiClass: 'ThreadGroupGui',
    name,
    enabled: true,
    numThreads: 1,
    rampTime: 1,
    scheduler: false,
    sameUserOnNextIteration: true,
    onSampleError: 'continue',
    loopController: {
      loops: 1,
      continueForever: false
    },
    children: []
  };
}

export function createRegexExtractor(name: string, refName: string): RegexExtractor {
  return {
    id: generateId(),
    type: 'RegexExtractor',
    testClass: 'RegexExtractor',
    guiClass: 'RegexExtractorGui',
    name,
    enabled: true,
    refName,
    regex: '',
    template: '$1$',
    defaultValue: '',
    matchNumber: 1,
    useHeaders: false,
    defaultEmptyValue: false,
    children: []
  };
}

export function createResponseAssertion(name: string): ResponseAssertion {
  return {
    id: generateId(),
    type: 'ResponseAssertion',
    testClass: 'ResponseAssertion',
    guiClass: 'AssertionGui',
    name,
    enabled: true,
    testField: 'response_code',
    testType: 8,
    testStrings: ['200'],
    assumeSuccess: false,
    children: []
  };
}

function generateId(): string {
  return `jmeter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
