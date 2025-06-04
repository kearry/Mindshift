import { retrieveRelevantContext } from '../ragUtils';

jest.mock('@lancedb/lancedb', () => ({
  connect: jest.fn(async () => ({
    tableNames: jest.fn(async () => []),
  })),
}));

jest.mock('@xenova/transformers', () => ({
  pipeline: jest.fn(async () => async () => ({ data: new Float32Array([0.1]) })),
}));

describe('retrieveRelevantContext', () => {
  it('returns no-context message when table is missing', async () => {
    const result = await retrieveRelevantContext('hello', 1);
    expect(result).toBe('[No context available yet - this appears to be the first debate on this topic]');
  });
});
