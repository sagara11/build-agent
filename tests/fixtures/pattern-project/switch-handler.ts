export function handleAction(action: string): string {
  switch (action) {
    case 'create':
      return 'created';
    case 'read':
      return 'read';
    case 'update':
      return 'updated';
    case 'delete':
      return 'deleted';
    case 'archive':
      return 'archived';
    case 'restore':
      return 'restored';
    default:
      return 'unknown';
  }
}

export function processType(type: number): string {
  if (type === 1) {
    return 'admin';
  } else if (type === 2) {
    return 'editor';
  } else if (type === 3) {
    return 'viewer';
  } else if (type === 4) {
    return 'guest';
  } else if (type === 5) {
    return 'superadmin';
  } else {
    return 'unknown';
  }
}
