import { POST } from '../route';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { createHmac } from 'crypto';

declare const global: { [key: string]: unknown };

jest.mock('@prisma/client', () => {
  const mockUser = { findFirst: jest.fn() };
  return { PrismaClient: jest.fn(() => ({ user: mockUser, $disconnect: jest.fn() })) };
});

jest.mock('bcrypt', () => ({ compare: jest.fn() }));

const base64Url = (input: Buffer) => input.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

describe('login POST', () => {
  const prisma = new PrismaClient();

  it('returns JWT on successful login', async () => {
    const user = { userId: 1, username: 'testuser', email: 'test@example.com', passwordHash: 'hash' };
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(user);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const body = { identifier: 'testuser', password: 'pass' };
    const request = new Request('http://localhost', { method: 'POST', body: JSON.stringify(body) });
    process.env.JWT_SECRET = 'testsecret';
    const response = await POST(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(typeof data.token).toBe('string');
    expect(data.user.passwordHash).toBeUndefined();
    const [header, payload, signature] = data.token.split('.');
    const decodedData = `${header}.${payload}`;
    const expectedSig = createHmac('sha256', 'testsecret').update(decodedData).digest();
    expect(signature).toBe(base64Url(expectedSig));
    const payloadObj = JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
    expect(payloadObj.userId).toBe(1);
  });
});
