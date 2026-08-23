import { SOCKET_NAME } from "../constants.js";

const handlers = new Map();
const pending = new Map();

function activeGM() {
  return game.users?.activeGM ?? game.users?.find((user) => user.active && user.isGM) ?? null;
}

function isAuthority(authorityUserId, gmRequired) {
  if (gmRequired) return activeGM()?.id === game.user.id;
  return (activeGM()?.id ?? authorityUserId) === game.user.id;
}

async function receive(packet) {
  if (packet.type === "response") {
    const request = pending.get(packet.requestId);
    if (!request) return;
    pending.delete(packet.requestId);
    clearTimeout(request.timeout);
    packet.ok ? request.resolve(packet.result) : request.reject(new Error(packet.error));
    return;
  }
  if (packet.type !== "request" || !isAuthority(packet.authorityUserId, packet.gmRequired)) return;
  const handler = handlers.get(packet.operation);
  if (!handler) return;
  try {
    const result = await handler(packet.payload, packet.userId);
    game.socket.emit(SOCKET_NAME, { type: "response", requestId: packet.requestId, ok: true, result });
  } catch (error) {
    console.error(`${SOCKET_NAME} | ${packet.operation}`, error);
    game.socket.emit(SOCKET_NAME, { type: "response", requestId: packet.requestId, ok: false, error: error.message });
  }
}

export function registerSocket() {
  game.socket.on(SOCKET_NAME, receive);
}

export function registerOperation(name, handler) {
  handlers.set(name, handler);
}

export async function requestOperation(operation, payload, { authorityUserId = game.user.id, gmRequired = false } = {}) {
  const packet = {
    type: "request",
    requestId: foundry.utils.randomID(),
    operation,
    payload,
    authorityUserId,
    gmRequired,
    userId: game.user.id,
  };
  if (isAuthority(authorityUserId, gmRequired)) {
    const handler = handlers.get(operation);
    if (!handler) throw new Error(`No handler registered for ${operation}.`);
    return handler(payload, game.user.id);
  }
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(packet.requestId);
      reject(new Error("Commander automation request timed out. Is a GM connected?"));
    }, 12_000);
    pending.set(packet.requestId, { resolve, reject, timeout });
    game.socket.emit(SOCKET_NAME, packet);
  });
}
