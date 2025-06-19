export const MAX_ARGUMENT_CHARS = parseInt(
  process.env.NEXT_PUBLIC_MAX_ARGUMENT_CHARS || process.env.MAX_ARGUMENT_CHARS || '1000',
  10
);
