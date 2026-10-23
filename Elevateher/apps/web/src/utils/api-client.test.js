import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiFetch } from './api-client';

describe('apiFetch', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('constructs correct URL and sends headers with auth token', async () => {
    localStorage.setItem('auth_token', 'test-token-123');

    const mockResponse = { id: 1, name: 'Mentee Test' };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-length': '50' }),
      json: async () => mockResponse,
    });

    const data = await apiFetch('/api/v1/profile');

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/profile',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token-123',
        }),
      })
    );
    expect(data).toEqual(mockResponse);
  });

  it('handles 204 No Content response gracefully', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      headers: new Headers(),
    });

    const result = await apiFetch('/api/v1/logout');
    expect(result).toBeNull();
  });

  it('throws descriptive error on API failure', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized access',
    });

    await expect(apiFetch('/api/v1/secret')).rejects.toThrow(
      'API error 401: Unauthorized access'
    );
  });
});
