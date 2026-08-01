export function runOneShotWorker<TRequest, TResponse, TResult>(
  worker: Worker,
  request: TRequest,
  receive: (response: TResponse) => TResult,
  fallbackMessage: string,
) {
  return new Promise<TResult>((resolve, reject) => {
    const finish = () => worker.terminate();
    worker.addEventListener(
      "message",
      (event: MessageEvent<TResponse>) => {
        finish();
        try {
          resolve(receive(event.data));
        } catch (error) {
          reject(error);
        }
      },
      { once: true },
    );
    worker.addEventListener(
      "error",
      () => {
        finish();
        reject(new Error(fallbackMessage));
      },
      { once: true },
    );
    worker.postMessage(request);
  });
}
