import type { Instrumentation } from "next";

export const onRequestError: Instrumentation.onRequestError = (
  error,
  request,
  context,
) => {
  const err = error as Error & { digest?: string };
  console.error(
    JSON.stringify({
      level: "error",
      event: "request_error",
      message: err.message,
      name: err.name,
      digest: err.digest,
      stack: err.stack,
      method: request.method,
      path: request.path.split("?")[0],
      routePath: context.routePath,
      routeType: context.routeType,
      renderSource: context.renderSource,
      runtime: process.env.NEXT_RUNTIME,
      time: new Date().toISOString(),
    }),
  );
};
