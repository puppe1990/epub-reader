import { fail, noContent } from './_lib/http';
import { getUploadMetadata, saveUploadChunk } from './_lib/uploads';

export const handleUploadsChunk = async (req: Request, uploadId: string, chunkIndex: number): Promise<Response> => {
  if (!Number.isInteger(chunkIndex) || chunkIndex < 0) {
    fail(400, 'Invalid chunk index.');
  }

  const metadata = await getUploadMetadata(uploadId);
  if (!metadata) {
    fail(404, 'Upload session not found.');
  }

  const data = new Uint8Array(await req.arrayBuffer());
  if (data.byteLength === 0) {
    fail(400, 'Chunk payload is empty.');
  }

  await saveUploadChunk(uploadId, chunkIndex, data);
  return noContent();
};
