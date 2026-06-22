import { Connection } from './connection';

export function setupA(): Connection {
  const conn = new Connection('hostA', 5432);
  conn.connect();
  return conn;
}

export function resetA(): Connection {
  const conn = new Connection('hostA', 5432);
  return conn;
}
