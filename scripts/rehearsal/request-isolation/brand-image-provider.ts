import assert from 'node:assert/strict';

export const syntheticBrandImageClient = {
  async send(command: { constructor: { name: string }; input: { Bucket?: string; Key?: string } }) {
    assert.equal(command.constructor.name, 'HeadObjectCommand');
    assert.equal(command.input.Bucket, 'synthetic');
    assert.match(command.input.Key ?? '', /^workspaces\/[ab]\/(testimonials|trusted-logos|photo-comparison|team|about)\/[a-zA-Z0-9_-]+\.(png|webp|jpg|avif)$/);
    return { ContentLength: 100, ContentType: 'image/png' };
  },
};
