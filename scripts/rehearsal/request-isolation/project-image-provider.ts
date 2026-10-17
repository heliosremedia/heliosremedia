import assert from 'node:assert/strict';

export const syntheticImageClient = {
  async send(command: { constructor: { name: string }; input: { Bucket?: string; Key?: string } }) {
    assert.equal(command.constructor.name, 'HeadObjectCommand');
    assert.equal(command.input.Bucket, 'synthetic');
    assert.match(command.input.Key ?? '', /^projects\/p[ab]\//);
    return { ContentLength: 100, ContentType: 'image/png' };
  },
};
