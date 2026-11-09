import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/api', () => ({ default: { put: vi.fn() } }));
vi.mock('../services/travelerApi', () => ({ default: { put: vi.fn() } }));

import api from '../services/api';
import travelerApi from '../services/travelerApi';
import { changePassword } from '../services/authService';
import { changePassword as changePasswordViajante } from '../services/travelerAuthService';

beforeEach(() => {
  api.put.mockReset().mockResolvedValue({ data: { message: 'ok' } });
  travelerApi.put.mockReset().mockResolvedValue({ data: { message: 'ok' } });
});

describe('alterar password envia a actual e a nova', () => {
  it('operador: PUT /auth/password com current_password e password', async () => {
    const r = await changePassword('Actual1!x', 'Nova1234!');
    expect(api.put).toHaveBeenCalledWith('/auth/password', { current_password: 'Actual1!x', password: 'Nova1234!' });
    expect(r).toEqual({ message: 'ok' });
  });

  it('viajante: PUT /traveler-auth/password com current_password e password', async () => {
    const r = await changePasswordViajante('Actual1!x', 'Nova1234!');
    expect(travelerApi.put).toHaveBeenCalledWith('/traveler-auth/password', { current_password: 'Actual1!x', password: 'Nova1234!' });
    expect(r).toEqual({ message: 'ok' });
  });
});
