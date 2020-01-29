import { createServer, IncomingMessage, ServerResponse } from "http";
import WebSocket from "socket.io";
import fs from "fs";

import {
  GetTableMessage,
  SetOptionsMessage,
  MachineHandler,
  ExecuteSqlMessage,
  SaveFileMessage,
  DeployMessage,
  TestMessage
} from "./Messages";
import { createMachine } from "./statemachine";
import { setup, getAllFromTable, executeSql, executeTest } from "./database";
import { Connection } from "oracledb";
import { saveToFile, deployFile } from "./filemanager";

function handler(_req: IncomingMessage, res: ServerResponse) {
  fs.readFile(__dirname + "/index.html", function(err, data) {
    if (err) {
      res.writeHead(500);
      return res.end("Error loading index.html");
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
    socket.emit("busy");
    return false;
  }
  machine.setPending();
  try {
    const r = await f(...args);
    machine.success();
    socket.emit("success", status);
    socket.emit("result", r);
    return r;
  } catch (e) {
    console.log(e);
    machine.failure();
    socket.emit("failure", e.message);
    return false;
  }
}

io.on("connection", function(socket) {
  let connection: false | Connection = false;
  let connectionOptions: false | SetOptionsMessage = false;
  const machine = createMachine();
  socket.on("state", () => socket.emit("state", machine.getState()));
  socket.on("options", async (data: SetOptionsMessage) => {
    connectionOptions = data;
    const conn = await handleAsync(setup, machine, socket, "connected", data);
    if (conn) {
      connection = conn;
    }
  });
  socket.on("save", (data: SaveFileMessage) => {
    handleAsync(saveToFile, machine, socket, "saved",data.file);
  });
  socket.on("deploy", async (_: DeployMessage) => {
    await handleAsync(deployFile, machine, socket, "deployed", connection, connectionOptions);
    
    const conn = await handleAsync(setup, machine, socket, "connected", connectionOptions);
    if (conn) {
      connection = conn;
    }
  });
  socket.on("getTable", (data: GetTableMessage) => {
    handleAsync(getAllFromTable, machine, socket, "gotTable", connection, data.table);
  });
  socket.on("executeSQL", (data: ExecuteSqlMessage) => {
    handleAsync(executeSql, machine, socket, "executed", connection, data.sql);
  });
  socket.on("test", (data: TestMessage) => {
    handleAsync(executeTest, machine, socket, "tested", connection, data.func, data.parameters);
  });
});

app.listen(8080, () => console.log("Server started"));
