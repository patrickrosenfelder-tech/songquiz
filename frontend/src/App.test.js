import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

class MockWebSocket {
  static OPEN = 1;
  static instance = null;

  constructor() {
    this.readyState = MockWebSocket.OPEN;
    this.sent = [];
    MockWebSocket.instance = this;
  }

  send(msg) {
    this.sent.push(JSON.parse(msg));
  }

  close() {}

  receive(message) {
    this.onmessage({ data: JSON.stringify(message) });
  }
}

let container;
let root;

beforeEach(() => {
  global.WebSocket = MockWebSocket;
  global.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

test('lobby renders player count, not raw Player objects', () => {
  const errors = jest.spyOn(console, 'error').mockImplementation(() => {});

  act(() => {
    root.render(<App />);
  });
  act(() => {
    MockWebSocket.instance.onopen();
  });

  const input = container.querySelector('.username-input');
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  act(() => {
    setValue.call(input, 'alice');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  act(() => {
    container.querySelector('.join-button').click();
  });

  const ws = MockWebSocket.instance;
  const player = { userId: 'alice', clientId: 'c1', score: 0, ready: false };

  // Server sends game-joined (players: Player[]) then player-joined (totalPlayers: number)
  act(() => {
    ws.receive({
      type: 'game-joined',
      gameId: 'g1',
      clientId: 'c1',
      gameState: { players: [player], currentRound: 0, totalRounds: 10 },
    });
    ws.receive({ type: 'player-joined', userId: 'alice', totalPlayers: 1 });
  });

  expect(container.querySelector('.players-count').textContent).toBe('Players joined: 1');

  // gameId must survive the player-joined update (was clobbered by a stale closure)
  act(() => {
    container.querySelector('.start-button').click();
  });
  expect(ws.sent.map((m) => m.type)).toEqual(['join', 'ready']);

  expect(errors).not.toHaveBeenCalled();
  errors.mockRestore();
});
