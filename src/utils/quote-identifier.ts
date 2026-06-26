export function quoteIdentifier(value: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('Invalid SQL identifier: identifier cannot be empty');
  }

  const parts = value.split('.');
  const invalidPart = parts.find((part) => part.trim().length === 0);

  if (invalidPart !== undefined) {
    throw new Error(
      `Invalid SQL identifier: each segment must be non-empty. Received: ${value}`,
    );
  }

  return parts.map((part) => `"${part.replace(/"/g, '""')}"`).join('.');
}
