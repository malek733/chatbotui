import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import crypto from 'crypto';
import { WebSocketServer } from 'ws';  // Only use named import
import http from 'http';
import process from 'process';
import { Buffer } from 'buffer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize environment variables
dotenv.config({ path: new URL('../../.env', import.meta.url) });

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });  // Use WebSocketServer constructor
const PORT = process.env.WEBHOOK_PORT || 3001;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('New WebSocket client connected');
  ws.on('error', console.error);
});

// Broadcast to all connected clients
const broadcast = (message) => {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
};

// Enhanced CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST']
}));

app.use(bodyParser.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

// Verify Chatwoot webhook signature
const verifyWebhookSignature = (req, res, next) => {
  try {
    const signature = req.headers['x-chatwoot-signature'];
    
    if (!WEBHOOK_SECRET) {
      console.warn('WEBHOOK_SECRET not configured');
      return next();
    }

    if (!signature) {
      return res.status(401).json({ 
        error: 'No signature provided',
        timestamp: new Date().toISOString()
      });
    }

    const body = JSON.stringify(req.body);
    const hmac = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(body)
      .digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(hmac))) {
      return res.status(401).json({ 
        error: 'Invalid signature',
        timestamp: new Date().toISOString()
      });
    }

    next();
  } catch (error) {
    console.error('Signature verification error:', error);
    return res.status(500).json({ 
      error: 'Signature verification failed',
      timestamp: new Date().toISOString()
    });
  }
};

// Webhook handler
const handleChatwootWebhook = async (req, res) => {
  try {
    const { event, data } = req.body;

    if (!event || !data) {
      return res.status(400).json({ 
        error: 'Invalid webhook payload',
        timestamp: new Date().toISOString()
      });
    }

    const timestamp = new Date().toISOString();
    console.log(`Received webhook event: ${event}`, { timestamp, data });

switch (event) {
  case 'message_created': {
    if (data.message_type === 'outgoing') {
      const message = {
        type: 'agent_message',
        conversationId: data.conversation_id,
        content: data.content,
        messageId: data.id,
        timestamp
      };
      broadcast(message);
      console.log('Agent message broadcast:', message);
    }
    break;
  }
  
  case 'conversation_status_changed': {
    const statusUpdate = {
      type: 'status_update',
      conversationId: data.conversation_id,
      status: data.status,
      timestamp
    };
    broadcast(statusUpdate);
    console.log('Status update broadcast:', statusUpdate);
    break;
  }

  default: {
    console.log('Unhandled webhook event:', { event, timestamp });
  }
}

    return res.status(200).json({ 
      success: true,
      event,
      timestamp
    });
  } catch (error) {
    console.error('Webhook handler error:', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

// Routes
app.post('/webhook/chatwoot', verifyWebhookSignature, handleChatwootWebhook);

// Health check route
app.get('/health', (_, res) => {
  res.status(200).json({ 
    status: 'OK',
    wsClients: wss.clients.size,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Global error handler
// ...existing code...

// Global error handler
app.use((err, req, res, /* unused next */) => {
  console.error('Unhandled error:', {
    error: err.message,
    stack: err.stack,
    timestamp: new Date().toISOString()
  });
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});


// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server running on ws://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Webhook endpoint: http://localhost:${PORT}/webhook/chatwoot`);
});

// Graceful shutdown
const shutdown = () => {
  console.log('Shutting down server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);