import { createServer, IncomingMessage, ServerResponse } from 'http';
import WebSocket from 'socket.io';
import fs from 'fs';

import {
  GetTableMessage,
  SetOptionsMessage,
  MachineHandler,
  ExecuteSqlMessage,
  SaveFileMessage,
  TestMessage,
  TestsMessage,
} from './Messages';
import { createMachine } from './statemachine';
import {
  setup,
  getAllFromTable,
  executeSql,
  executeTest,
  getTypes,
  multipleTests,
  benchmark,
} from './database';
import { Connection } from 'oracledb';
import { saveToFile, deployFile, readFile } from './filemanager';

function handler(_req: IncomingMessage, res: ServerResponse): void {
  fs.readFile(__dirname + '/index.html', function(err, data) {
    if (err) {
      res.writeHead(500);
      return res.end('Error loading index.html');
    }
    res.writeHead(200);
    res.end(data);
  });
}

const app = createServer(handler);
const io = WebSocket(app);

async function handleAsync<ReturnType>(
  f: (...args: Array<any>) => Promise<ReturnType>,
  machine: MachineHandler,
  socket: WebSocket.Socket,
  status: string,
  ...args: Array<any>
): Promise<ReturnType | false> {
  if (machine.isPending()) {
    socket.emit('busy');
    return false;
  }
  machine.setPending();
  try {
    const r = await f(...args);
    machine.success();
    socket.emit('result', r, status);
    return r;
  } catch (e) {
    console.log(e);
    machine.failure();
    socket.emit('failure', e.message);
    return false;
  }
}

io.on('connection', function(socket) {
  let connection: false | Connection = false;
  let connectionOptions: false | SetOptionsMessage = false;
  const machine = createMachine();
  socket.on('state', () => socket.emit('state', machine.getState()));
  socket.on('options', async (data: SetOptionsMessage) => {
    connectionOptions = data;
    const conn = await handleAsync(setup, machine, socket, 'connected', data);
    if (conn) {
      connection = conn;
    }
  });
  socket.on('save', (data: SaveFileMessage) => {
    handleAsync(saveToFile, machine, socket, 'saved', data.file);
  });
  socket.on('read', () => {
    handleAsync(readFile, machine, socket, 'read');
  });
  socket.on('deploy', async () => {
    await handleAsync(
      deployFile,
      machine,
      socket,
      'deployed',
      connection,
      connectionOptions
    );

    const conn = await handleAsync(
      setup,
      machine,
      socket,
      'connected',
      connectionOptions
    );
    if (conn) {
      connection = conn;
    }
  });
  socket.on('getTypes', () => {
    handleAsync(getTypes, machine, socket, 'gotTypes', connection);
  });
  socket.on('getTable', (data: GetTableMessage) => {
    handleAsync(
      getAllFromTable,
      machine,
      socket,
      'gotTable',
      connection,
      data.table
    );
  });
  socket.on('executeSQL', (data: ExecuteSqlMessage) => {
    handleAsync(executeSql, machine, socket, 'executed', connection, data.sql);
  });
  socket.on('test', (data: TestMessage) => {
    handleAsync(
      executeTest,
      machine,
      socket,
      'tested',
      data.id,
      connection,
      data.func,
      data.parameters
    );
  });
  socket.on('multipleTests', (data: TestsMessage) => {
    handleAsync(
      multipleTests,
      machine,
      socket,
      'multipleTests',
      connection,
      data
    );
  });
  socket.on('benchmark', () => {
    handleAsync(benchmark, machine, socket, 'benchmark', connection);
  });
});

app.listen(8080, () => console.log('Server started'));
