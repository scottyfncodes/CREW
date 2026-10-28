import { afterEach, describe, expect, it, vi } from 'vitest';
import { saveFile } from './download';

afterEach(() => vi.unstubAllGlobals());

function stubShare(share: () => Promise<void>) {
  vi.stubGlobal('navigator', { canShare: () => true, share: vi.fn(share) });
}

describe('saveFile', () => {
  it('uses the share sheet where it accepts files', async () => {
    stubShare(async () => {});
    await expect(saveFile('crew-backup.json', '{}', 'application/json')).resolves.toBe('shared');
  });

  it('reports a cancelled share sheet as cancelled, not saved', async () => {
    stubShare(async () => {
      throw new DOMException('cancelled', 'AbortError');
    });
    await expect(saveFile('crew-backup.json', '{}', 'application/json')).resolves.toBe('cancelled');
  });

  it('passes on any other share failure', async () => {
    stubShare(async () => {
      throw new DOMException('denied', 'NotAllowedError');
    });
    await expect(saveFile('crew-backup.json', '{}', 'application/json')).rejects.toThrow();
  });
});
