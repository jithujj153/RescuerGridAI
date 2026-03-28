import { logger } from "@/lib/logger";

describe("logger", () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    jest.restoreAllMocks();
  });

  it("outputs structured JSON to console.error for error level", () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    logger.error("test error", { requestId: "abc-123" });

    expect(spy).toHaveBeenCalledTimes(1);
    const output = JSON.parse(spy.mock.calls[0][0] as string);
    expect(output.level).toBe("error");
    expect(output.message).toBe("test error");
    expect(output.requestId).toBe("abc-123");
    expect(output.service).toBe("rescuegrid-ai");
    expect(output.timestamp).toBeDefined();
  });

  it("outputs structured JSON to console.info for info level", () => {
    const spy = jest.spyOn(console, "info").mockImplementation(() => {});
    logger.info("operation completed", { duration: 150 });

    expect(spy).toHaveBeenCalledTimes(1);
    const output = JSON.parse(spy.mock.calls[0][0] as string);
    expect(output.level).toBe("info");
    expect(output.duration).toBe(150);
  });

  it("outputs structured JSON to console.warn for warn level", () => {
    const spy = jest.spyOn(console, "warn").mockImplementation(() => {});
    logger.warn("rate limit approaching");

    expect(spy).toHaveBeenCalledTimes(1);
    const output = JSON.parse(spy.mock.calls[0][0] as string);
    expect(output.level).toBe("warn");
  });

  it("includes the service name in all log entries", () => {
    const spy = jest.spyOn(console, "info").mockImplementation(() => {});
    logger.info("test");

    const output = JSON.parse(spy.mock.calls[0][0] as string);
    expect(output.service).toBe("rescuegrid-ai");
  });
});
