import { Connection } from './connection';

export function setupB(): Connection {
  const conn = new Connection('hostB', 3306);
  conn.connect();
  return conn;
}

export function resetB(): Connection {
  const conn = new Connection('hostB', 3306);
  return conn;
}
