import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';
import { ZodError } from 'zod';
import {
  apiErrorSchema,
  goalCommandSchema,
  modeCommandSchema,
  velocityCommandSchema,
} from '@insight/shared';
import type { FastifyInstance } from 'fastify';
import { AppError } from './errors';
import { RobotSimulator } from './simulation/robotSimulator';

type BuildAppOptions = {
  logger?: boolean;
  simulator?: RobotSimulator;
  serveWeb?: boolean;
};

function resolveWebDist() {
  return resolve(dirname(fileURLToPath(import.meta.url)), '../../web/dist');
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const isProduction = process.env.NODE_ENV === 'production';
  const app = Fastify({
    logger:
      options.logger === false
        ? false
        : isProduction
          ? true
          : {
              transport: {
                target: 'pino-pretty',
                options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
              },
            },
    genReqId: () => randomUUID(),
    bodyLimit: 16 * 1024,
  });

  const simulator = options.simulator ?? new RobotSimulator();

  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  });

  await app.register(cors, {
    origin: isProduction
      ? false
      : ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:4173'],
  });

  app.addHook('onClose', async () => {
    simulator.stop();
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          requestId: request.id,
        },
      });
    }

    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.issues[0]?.message ?? 'Invalid request payload.',
          requestId: request.id,
        },
      });
    }

    request.log.error({ err: error }, 'Unhandled request error');
    return reply.code(500).send(
      apiErrorSchema.parse({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'The request could not be completed.',
          requestId: request.id,
        },
      }),
    );
  });

  app.get('/api/health', async () => ({
    ok: true,
    data: { status: 'ok', service: 'insight-telemetry', time: new Date().toISOString() },
  }));

  app.get('/api/state', async () => ({ ok: true, data: simulator.getState() }));

  app.get('/api/telemetry/stream', (request, reply) => {
    reply.hijack();
    const raw = reply.raw;
    raw.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': request.headers.origin ?? '*',
    });
    raw.write('retry: 2500\n\n');

    const send = (state: unknown) => {
      raw.write(`data: ${JSON.stringify(state)}\n\n`);
    };

    const unsubscribe = simulator.subscribe(send);
    const heartbeat = setInterval(() => {
      raw.write(`: ping ${Date.now()}\n\n`);
    }, 15_000);
    heartbeat.unref?.();

    const cleanup = () => {
      clearInterval(heartbeat);
      unsubscribe();
    };

    request.raw.on('close', cleanup);
    raw.on('error', cleanup);
  });

  app.post('/api/mission/goal', async (request) => {
    const body = goalCommandSchema.parse(request.body);
    return { ok: true, data: simulator.setGoal(body.goalId) };
  });

  app.post('/api/mission/initiate', async (request) => {
    const body = request.body as { goalId?: unknown } | undefined;
    const goalId = body && typeof body.goalId === 'string' ? body.goalId : undefined;
    return { ok: true, data: simulator.initiate(goalId) };
  });

  app.post('/api/mission/pause', async () => ({ ok: true, data: simulator.pause() }));
  app.post('/api/mission/resume', async () => ({ ok: true, data: simulator.resume() }));

  app.post('/api/robot/mode', async (request) => {
    const body = modeCommandSchema.parse(request.body);
    return { ok: true, data: simulator.setMode(body.mode) };
  });

  app.post('/api/robot/velocity', async (request) => {
    const body = velocityCommandSchema.parse(request.body);
    return { ok: true, data: simulator.setVelocity(body.linear, body.angular) };
  });

  app.post('/api/emergency/stop', async () => ({ ok: true, data: simulator.emergencyStop() }));
  app.post('/api/emergency/reset', async () => ({
    ok: true,
    data: simulator.resetEmergencyStop(),
  }));

  const webDist = resolveWebDist();
  const shouldServeWeb = options.serveWeb ?? existsSync(webDist);

  if (shouldServeWeb && existsSync(webDist)) {
    await app.register(fastifyStatic, {
      root: webDist,
      prefix: '/',
      maxAge: '1h',
    });

    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api/')) {
        return reply.code(404).send({
          error: {
            code: 'NOT_FOUND',
            message: 'API route not found.',
            requestId: request.id,
          },
        });
      }
      return reply.sendFile('index.html');
    });
  } else {
    app.setNotFoundHandler((request, reply) => {
      return reply.code(404).send({
        error: {
          code: 'NOT_FOUND',
          message: 'Route not found.',
          requestId: request.id,
        },
      });
    });
  }

  return app;
}
