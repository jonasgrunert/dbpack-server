import { createServer, IncomingMessage, ServerResponse } from 'http';
import WebSocket from 'socket.io';
import fs from 'fs';

import {
  GetTableMessage,
  SetOptionsMessage,
  MachineHandler,
  ExecuteSqlMessage,
  SaveFileMessage,
  DeployMessage,
  TestMessage,
} from './Messages';
import { createMachine } from 'statemachine';
import { setup, getAllFromTable, executeSql, executeTest } from 'database';
import { Connection } from 'oracledb';
import { saveToFile, deployFile } from 'filemanager';

function handler(_req: IncomingMessage, res: ServerResponse) {
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
app.listen(80);

const io = WebSocket(app);

async function handleAsync<ReturnType>(
  f: (...args: Array<any>) => Promise<ReturnType>,
  machine: MachineHandler,
  socket: WebSocket.Socket,
  ...args: Array<any>
): Promise<ReturnType | false> {
  if (!machine.isActive()) {
    socket.emit('busy');
    return false;
  }
  machine.setPending();
  try {
    const r = await f(args);
    machine.success();
    socket.emit('success');
    socket.emit('result', r);
    return r;
  } catch (e) {
    machine.failure();
    socket.emit('failure', e);
    return false;
  }
}

io.on('connection', function(socket) {
  let connection: false | Connection = false;
  let connectionString: false | string = false;
  socket.emit('connected');
  const machine = createMachine();
  socket.on('state', () => socket.emit('state', machine.getState()));
  socket.on('options', async (data: SetOptionsMessage) => {
    const conn = await handleAsync(setup, machine, socket, data);
    if (conn) {
      connection = conn;
      connectionString = data.connectionString!;
    }
  });
  socket.on('save', (data: SaveFileMessage) => {
    handleAsync(saveToFile, machine, socket, data.file);
  });
  socket.on('deploy', (_data: DeployMessage) => {
    handleAsync(deployFile, machine, socket, connectionString);
  });
  socket.on('getTable', (data: GetTableMessage) => {
    handleAsync(getAllFromTable, machine, socket, connection, data.table);
  });
  socket.on('executeSQL', (data: ExecuteSqlMessage) => {
    handleAsync(executeSql, machine, socket, connection, data.sql);
  });
  socket.on('test', (data: TestMessage) => {
    handleAsync(executeTest, machine, socket, data.func, data.parameters);
  });
});
