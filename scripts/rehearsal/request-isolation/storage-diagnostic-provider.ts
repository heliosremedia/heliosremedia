// Only the diagnostic route imports this explicit no-network rehearsal provider.
export const r2Config = { publicUrl: 'https://synthetic.invalid', bucketName: 'synthetic' };
export const r2Client = { send: async (command: unknown) => { void command; return { Contents: [{ Key: 'PRIVATE_PLATFORM_STORAGE_OBJECT' }] }; } };
