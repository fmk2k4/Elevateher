import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getBackendBaseUrl, getRawAccessToken, proxyJsonToBackend } from '../app/api/utils/backend';

describe('backend utilities', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    delete process.env.NEXT_PUBLIC_API_URL;
    delete process.env.VITE_API_URL;
    delete process.env.AUTH_URL;
  });

  describe('getBackendBaseUrl', () => {
    it('defaults to localhost:8000 when no env vars set', () => {
      expect(getBackendBaseUrl()).toBe('http://localhost:8000');
    });

    it('uses NEXT_PUBLIC_API_URL when set', () => {
      process.env.NEXT_PUBLIC_API_URL = 'https://api.elevateher.app';
      expect(getBackendBaseUrl()).toBe('https://api.elevateher.app');
    });

    it('strips trailing slash', () => {
      process.env.VITE_API_URL = 'http://localhost:8000/';
      expect(getBackendBaseUrl()).toBe('http://localhost:8000');
    });
  });

  describe('getRawAccessToken', () => {
    it('extracts Bearer token from Authorization header', async () => {
      const request = new Request('http://localhost/api/test', {
        headers: { Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' },
      });
      const token = await getRawAccessToken(request);
      expect(token).toBe('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
    });

    it('returns null when no Authorization header', async () => {
      const request = new Request('http://localhost/api/test');
      const token = await getRawAccessToken(request);
      expect(token).toBeNull();
    });

    it('returns null when header is not Bearer scheme', async () => {
      const request = new Request('http://localhost/api/test', {
        headers: { Authorization: 'Basic dXNlcjpwYXNz' },
      });
      const token = await getRawAccessToken(request);
      expect(token).toBeNull();
    });
  });

  describe('proxyJsonToBackend', () => {
    it('returns 401 when no Bearer token provided', async () => {
      const request = new Request('http://localhost/api/test');
      const response = await proxyJsonToBackend(request, '/mentee/profile');
      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Unauthorized');
    });

    it('forwards Authorization header to backend with token', async () => {
      global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }));

      const request = new Request('http://localhost/api/mentee/profile', {
        headers: { Authorization: 'Bearer test-token-123' },
      });

      const response = await proxyJsonToBackend(request, '/mentee/profile');

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const callArgs = global.fetch.mock.calls[0];
      expect(callArgs[0].href).toBe('http://localhost:8000/mentee/profile');
      expect(callArgs[1].headers.Authorization).toBe('Bearer test-token-123');
      expect(response.status).toBe(200);
    });

    it('uses VITE_API_URL as base when set', async () => {
      global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }));
      process.env.VITE_API_URL = 'https://staging-api.elevateher.app';

      const request = new Request('http://localhost/api/test', {
        headers: { Authorization: 'Bearer token-xyz' },
      });

      await proxyJsonToBackend(request, '/test');

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const callArgs = global.fetch.mock.calls[0];
      expect(callArgs[0].href).toBe('https://staging-api.elevateher.app/test');
      expect(callArgs[1].headers.Authorization).toBe('Bearer token-xyz');
    });
  });
});
