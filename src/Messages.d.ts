import { ConnectionAttributes } from 'oracledb';
import { State, DefaultContext, EventObject } from 'xstate';

export interface MachineHandler {
  getState: () => State<DefaultContext, EventObject>;
  isActive: () => boolean;
  isInactive: () => boolean;
  isPending: () => boolean;
  setPending: () => void;
  success: () => void;
  failure: () => void;
}

export interface GetTableMessage {
  table: string;
}

export interface SetOptionsMessage extends ConnectionAttributes {}

export interface ExecuteSqlMessage {
  sql: string;
}

export interface SaveFileMessage {
  file: string;
}

export interface TestMessage {
  id: string;
  func: string;
  parameters: Array<string | number>;
}

export type TestsMessage = Array<TestMessage>;
