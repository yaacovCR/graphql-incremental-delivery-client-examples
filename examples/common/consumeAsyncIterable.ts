export function consumeAsyncIterable<TValue>(
  iterable: AsyncIterable<TValue>,
  onValue: (value: TValue) => void,
  onError?: (error: unknown) => void,
): () => void {
  let closed = false;
  const iterator = iterable[Symbol.asyncIterator]();

  void (async () => {
    try {
      while (!closed) {
        const result = await iterator.next();
        if (closed || result.done) {
          return;
        }
        onValue(result.value);
      }
    } catch (error) {
      if (closed) {
        return;
      }
      if (onError === undefined) {
        throw error;
      }
      onError(error);
    }
  })();

  return () => {
    closed = true;
    void iterator.return?.();
  };
}
