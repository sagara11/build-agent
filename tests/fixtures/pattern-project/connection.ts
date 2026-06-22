export class Connection {
  constructor(private host: string, private port: number) {}

  connect(): void {}
  disconnect(): void {}
  query(sql: string): unknown { return null; }
}
