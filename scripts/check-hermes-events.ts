import { initialHermesState, hermesEventReducer, messagesFromHistory } from '../src/state/hermesEventReducer';
import { readFileSync } from 'fs';
import { join } from 'path';

const fixturesDir = join(__dirname, '../tests/fixtures/hermes-events');

function testGatewayReady() {
  console.log('Testing gateway.ready event reducer...');
  const event = JSON.parse(readFileSync(join(fixturesDir, 'gateway-ready.json'), 'utf8'));
  const nextState = hermesEventReducer(initialHermesState, event);

  if (nextState.serverInfo?.name !== 'hermes-web-api') {
    throw new Error(`Expected serverInfo.name to be 'hermes-web-api', got: ${nextState.serverInfo?.name}`);
  }
  if (nextState.sessionInfo?.model !== 'anthropic/claude-sonnet-4') {
    throw new Error(`Expected sessionInfo.model to be 'anthropic/claude-sonnet-4', got: ${nextState.sessionInfo?.model}`);
  }
  console.log('✓ gateway.ready test passed.');
}

function testMessageStream() {
  console.log('Testing message.delta stream reducer...');
  const lines = readFileSync(join(fixturesDir, 'message-stream.jsonl'), 'utf8').split('\n').filter(Boolean);
  
  let state = { ...initialHermesState };
  for (const line of lines) {
    const event = JSON.parse(line);
    state = hermesEventReducer(state, event);
  }

  const lastMsg = state.messages[state.messages.length - 1];
  if (lastMsg.content !== 'Hello!') {
    throw new Error(`Expected final assistant message to be 'Hello!', got: ${lastMsg.content}`);
  }
  if (lastMsg.status !== 'completed') {
    throw new Error(`Expected last message status to be 'completed', got: ${lastMsg.status}`);
  }
  if (state.isRunning) {
    throw new Error('Expected isRunning to be false after completion');
  }
  console.log('✓ message stream test passed.');
}

function testToolLifecycle() {
  console.log('Testing tool lifecycle reducer...');
  const lines = readFileSync(join(fixturesDir, 'tool-lifecycle.jsonl'), 'utf8').split('\n').filter(Boolean);

  let state = { ...initialHermesState };
  // Pre-seed an active assistant message to receive tool events
  state.messages = [
    {
      id: 'assistant-1',
      role: 'assistant',
      content: '',
      tools: [],
      segments: [],
      status: 'running',
    }
  ];

  for (const line of lines) {
    const event = JSON.parse(line);
    state = hermesEventReducer(state, event);
  }

  const lastMsg = state.messages[0];
  if (lastMsg.tools.length !== 1) {
    throw new Error(`Expected 1 tool registered, got: ${lastMsg.tools.length}`);
  }
  const tool = lastMsg.tools[0];
  if (tool.tool !== 'shell.exec') {
    throw new Error(`Expected tool to be 'shell.exec', got: ${tool.tool}`);
  }
  if (tool.status !== 'completed') {
    throw new Error(`Expected tool status to be 'completed', got: ${tool.status}`);
  }
  if (tool.preview !== '/workspace\n') {
    throw new Error(`Expected tool preview to be '/workspace\\n', got: ${tool.preview}`);
  }
  console.log('✓ tool lifecycle test passed.');
}

function testToolNameFallback() {
  console.log('Testing tool.start name property fallback...');
  let state = { ...initialHermesState };
  state.messages = [
    {
      id: 'assistant-1',
      role: 'assistant',
      content: '',
      tools: [],
      segments: [],
      status: 'running',
    }
  ];

  // Send tool.start with payload.name instead of payload.tool
  state = hermesEventReducer(state, {
    type: 'tool.start',
    payload: { name: 'terminal.exec', id: 't-name-1' }
  });

  const lastMsg = state.messages[0];
  if (lastMsg.tools.length !== 1) {
    throw new Error('Expected 1 tool registered');
  }
  const tool = lastMsg.tools[0];
  if (tool.tool !== 'terminal.exec') {
    throw new Error(`Expected tool name to fall back to 'terminal.exec', got: ${tool.tool}`);
  }
  if (tool.id !== 't-name-1') {
    throw new Error(`Expected tool id to be 't-name-1', got: ${tool.id}`);
  }
  console.log('✓ tool name fallback test passed.');
}

function testBlockingRequests() {
  console.log('Testing blocking prompts queue reducer...');
  const approvalEvent = JSON.parse(readFileSync(join(fixturesDir, 'approval-request.json'), 'utf8'));
  const clarifyEvent = JSON.parse(readFileSync(join(fixturesDir, 'clarify-request.json'), 'utf8'));

  let state = hermesEventReducer(initialHermesState, approvalEvent);
  state = hermesEventReducer(state, clarifyEvent);

  if (state.blockingRequests.length !== 2) {
    throw new Error(`Expected 2 blocking requests, got: ${state.blockingRequests.length}`);
  }
  if (state.blockingRequests[0].type !== 'approval') {
    throw new Error(`Expected first request type to be 'approval', got: ${state.blockingRequests[0].type}`);
  }
  if (state.blockingRequests[1].type !== 'clarify') {
    throw new Error(`Expected second request type to be 'clarify', got: ${state.blockingRequests[1].type}`);
  }
  console.log('✓ blocking prompts test passed.');
}

function testCustomActions() {
  console.log('Testing custom UI/Session actions...');

  // Resume start should not mark a requested persisted id as active before
  // the API returns the runtime session id.
  let loadingState = hermesEventReducer(initialHermesState, {
    type: 'session.resume_start',
    payload: { sessionId: 'persisted-session-id' }
  });
  if (loadingState.activeSessionId !== null) {
    throw new Error(`Expected resume_start to keep activeSessionId null, got: ${loadingState.activeSessionId}`);
  }
  if (!loadingState.isRunning || loadingState.statusLine !== 'Resuming session...') {
    throw new Error('Expected resume_start to enter loading state');
  }

  // 1. Test session.resume_success
  let state = hermesEventReducer(initialHermesState, {
    type: 'session.resume_success',
    payload: {
      sessionId: 'test-session-123',
      messages: [{ id: 'msg-1', role: 'user', content: 'hello', tools: [], segments: [], status: 'completed' }],
      config: { model: 'gpt-4o' }
    }
  });

  if (state.activeSessionId !== 'test-session-123') {
    throw new Error(`Expected activeSessionId to be 'test-session-123', got: ${state.activeSessionId}`);
  }
  if (state.messages.length !== 1 || state.messages[0].content !== 'hello') {
    throw new Error(`Expected 1 message with content 'hello', got: ${JSON.stringify(state.messages)}`);
  }
  if (state.sessionInfo?.model !== 'gpt-4o') {
    throw new Error(`Expected sessionInfo.model to be 'gpt-4o', got: ${state.sessionInfo?.model}`);
  }

  // 2. Test session.created
  state = hermesEventReducer(state, {
    type: 'session.created',
    payload: {
      sessionId: 'test-session-456',
      info: { provider: 'openai' }
    }
  });

  if (state.activeSessionId !== 'test-session-456') {
    throw new Error(`Expected activeSessionId to be 'test-session-456', got: ${state.activeSessionId}`);
  }
  if (state.sessionInfo?.provider !== 'openai') {
    throw new Error(`Expected sessionInfo.provider to be 'openai', got: ${state.sessionInfo?.provider}`);
  }

  // 3. Test message.user_sent
  state = hermesEventReducer(state, {
    type: 'message.user_sent',
    payload: {
      message: { id: 'msg-2', role: 'user', content: 'new message', tools: [], segments: [], status: 'completed' }
    }
  });

  if (state.messages.length !== 3 || state.messages[1].content !== 'new message' || state.messages[2].role !== 'assistant') {
    throw new Error(`Expected 3 messages, second with content 'new message', third as assistant, got: ${JSON.stringify(state.messages)}`);
  }

  // 4. Test blocking.resolve
  state.blockingRequests = [
    { type: 'approval', payload: {} },
    { type: 'clarify', payload: {} }
  ];
  state = hermesEventReducer(state, {
    type: 'blocking.resolve',
    payload: { type: 'approval' }
  });

  if (state.blockingRequests.length !== 1 || state.blockingRequests[0].type !== 'clarify') {
    throw new Error(`Expected 1 blocking request of type 'clarify', got: ${JSON.stringify(state.blockingRequests)}`);
  }

  // 5. Test session.clear
  state = hermesEventReducer(state, { type: 'session.clear' });
  if (state.messages.length !== 0) {
    throw new Error(`Expected messages to be empty, got: ${state.messages.length}`);
  }
  if (state.activeSessionId !== null) {
    throw new Error(`Expected activeSessionId to be null, got: ${state.activeSessionId}`);
  }
  if (state.sessionInfo !== null) {
    throw new Error(`Expected sessionInfo to be null, got: ${state.sessionInfo}`);
  }
  if (state.blockingRequests.length !== 0) {
    throw new Error(`Expected blockingRequests to be empty, got: ${state.blockingRequests.length}`);
  }

  // 6. Test error clearing & fallback behavior
  let errState = hermesEventReducer(initialHermesState, {
    type: 'error',
    payload: { message: 'Some Error' }
  });
  if (errState.error !== 'Some Error') {
    throw new Error(`Expected error to be 'Some Error', got: ${errState.error}`);
  }

  // Clear error purely
  errState = hermesEventReducer(errState, {
    type: 'error',
    payload: { message: null }
  });
  if (errState.error !== null) {
    throw new Error(`Expected error to be cleared (null), got: ${errState.error}`);
  }

  // Fallback behavior
  errState = hermesEventReducer(errState, {
    type: 'error',
    payload: {}
  });
  if (errState.error !== 'Unknown error occurred') {
    throw new Error(`Expected error fallback to 'Unknown error occurred', got: ${errState.error}`);
  }

  console.log('✓ custom UI/Session actions test passed.');
}

function testHistoryConversionSkipsEmptyMessages() {
  console.log('Testing history conversion skips empty messages...');
  const messages = [
    { role: 'user', text: 'hey' },
    { role: 'assistant', text: '' },
    { role: 'assistant', content: null },
    { role: 'assistant', text: 'hello' },
    { role: 'assistant', reasoning: 'checking' },
  ];

  const converted = messagesFromHistory(messages as any, 'session-1');
  if (converted.length !== 3) {
    throw new Error(`Expected 3 converted messages, got: ${converted.length}`);
  }
  if (converted.some((message) => !message.content && !message.segments.length)) {
    throw new Error(`Expected no empty converted messages, got: ${JSON.stringify(converted)}`);
  }
  console.log('✓ history empty-message filtering test passed.');
}

function testReasoningDeltaStream() {
  console.log('Testing reasoning.delta stream reducer...');
  let state = { ...initialHermesState };
  state.messages = [
    {
      id: 'assistant-1',
      role: 'assistant',
      content: '',
      tools: [],
      segments: [],
      status: 'running',
    }
  ];

  // Send thinking.delta
  state = hermesEventReducer(state, {
    type: 'thinking.delta',
    payload: { text: 'Thinking step 1. ' }
  });

  // Send reasoning.delta
  state = hermesEventReducer(state, {
    type: 'reasoning.delta',
    payload: { text: 'Reasoning step 2.' }
  });

  const lastMsg = state.messages[0];
  const thinkingSegment = lastMsg.segments.find(s => s.type === 'thinking');
  if (!thinkingSegment) {
    throw new Error('Expected a thinking segment to exist');
  }
  if (thinkingSegment.content !== 'Thinking step 1. Reasoning step 2.') {
    throw new Error(`Expected thinking content to combine both thinking and reasoning deltas, got: ${thinkingSegment.content}`);
  }
  console.log('✓ reasoning.delta stream test passed.');
}

function testReasoningDeltaDedupe() {
  console.log('Testing duplicated reasoning delta normalization...');
  let state = { ...initialHermesState };
  state.messages = [
    {
      id: 'assistant-1',
      role: 'assistant',
      content: '',
      tools: [],
      segments: [],
      status: 'running',
    }
  ];

  state = hermesEventReducer(state, {
    type: 'thinking.delta',
    payload: { text: 'Actually,' }
  });
  state = hermesEventReducer(state, {
    type: 'reasoning.delta',
    payload: { text: 'Actually,' }
  });
  state = hermesEventReducer(state, {
    type: 'reasoning.delta',
    payload: { text: 'Actually, let me check' }
  });
  state = hermesEventReducer(state, {
    type: 'thinking.delta',
    payload: { text: ' check quickly.' }
  });

  const lastMsg = state.messages[0];
  const thinkingSegment = lastMsg.segments.find(s => s.type === 'thinking');
  if (!thinkingSegment) {
    throw new Error('Expected a thinking segment to exist');
  }
  if (thinkingSegment.content !== 'Actually, let me check quickly.') {
    throw new Error(`Expected normalized reasoning content, got: ${thinkingSegment.content}`);
  }
  console.log('✓ duplicated reasoning delta normalization test passed.');
}

function runAll() {
  try {
    testGatewayReady();
    testMessageStream();
    testReasoningDeltaStream();
    testReasoningDeltaDedupe();
    testToolLifecycle();
    testToolNameFallback();
    testBlockingRequests();
    testCustomActions();
    testHistoryConversionSkipsEmptyMessages();
    console.log('\nAll pure event reducer smoke tests passed!');
  } catch (err: any) {
    console.error('\nSmoke tests failed:', err.message);
    process.exit(1);
  }
}

runAll();
