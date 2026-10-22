/** Cut an upload off once it passes a size limit, without buffering it. */
export function limited(stream: ReadableStream<Uint8Array>, max: number) {
  let seen = 0;
  return stream.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        seen += chunk.byteLength;
        if (seen > max) controller.error(new Error("That file is larger than this server accepts."));
        else controller.enqueue(chunk);
      },
    })
  );
}
