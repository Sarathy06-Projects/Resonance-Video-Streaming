import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { verifySessionToken } from './utils/auth';
import { roomManager } from './room/manager';
import { RoomEvent } from './types';

export function setupWebSocketServer(server: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', async (request, socket, head) => {
    try {
      const parsedUrl = new URL(request.url || '', 'http://localhost');
      const pathname = parsedUrl.pathname;

      // Match /api/rooms/:roomId/connect or /ws?roomId=...
      const match = pathname.match(/\/api\/rooms\/([a-zA-Z0-9_-]+)\/connect/);
      const roomId = match ? match[1] : (parsedUrl.searchParams.get('roomId') as string);
      const token = (parsedUrl.searchParams.get('token') as string) || (request.headers['sec-websocket-protocol'] as string);

      if (!roomId || !token) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      const decoded = verifySessionToken(token);
      if (!decoded || decoded.roomId !== roomId) {
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
        socket.destroy();
        return;
      }

      const coordinator = await roomManager.getCoordinator(roomId);
      if (!coordinator) {
        socket.write('HTTP/1.1 404 Room Not Found\r\n\r\n');
        socket.destroy();
        return;
      }

      if (coordinator.metadata.isLocked && decoded.role !== 'host') {
        socket.write('HTTP/1.1 403 Room Locked\r\n\r\n');
        socket.destroy();
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request, { coordinator, session: decoded });
      });
    } catch (err) {
      console.error('[WebSocket Upgrade Error]', err);
      socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
      socket.destroy();
    }
  });

  wss.on('connection', (ws: WebSocket, _req: any, context: any) => {
    const { coordinator, session } = context;

    const participant = {
      id: session.userId,
      name: session.name,
      role: session.role,
      color: session.color,
      joinedAt: Date.now(),
      lastActive: Date.now(),
    };

    coordinator.addClient(ws, participant);

    ws.on('message', (data: any) => {
      try {
        const text = data.toString();
        const event: RoomEvent = JSON.parse(text);
        if (event && event.type) {
          coordinator.handleEvent(session.userId, event);
        }
      } catch (err) {
        console.error('[WS Message Parse Error]', err);
      }
    });

    ws.on('close', () => {
      coordinator.removeClient(session.userId);
    });

    ws.on('error', (err) => {
      console.error(`[WS Error] client ${session.userId}:`, err);
      coordinator.removeClient(session.userId);
    });
  });

  return wss;
}
