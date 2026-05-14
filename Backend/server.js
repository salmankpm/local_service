// ─────────────────────────────────────────────────────────────
//  Sewa — Backend Entry Point
//  Node.js + Express + Socket.io + MongoDB
// ─────────────────────────────────────────────────────────────
const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const cors       = require('cors');
const dotenv     = require('dotenv');
const path       = require('path');
const connectDB  = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

dotenv.config();
connectDB();

const app    = express();
const server = http.createServer(app);

// ── Socket.io ─────────────────────────────────
const allowedOrigin = process.env.NODE_ENV === 'production' 
  ? process.env.CLIENT_URL 
  : [/^http:\/\/localhost:\d+$/, 'http://localhost:5173'];

const io = new Server(server, {
  cors: {
    origin: allowedOrigin,
    methods: ['GET', 'POST'],
  },
});

io.on('connection', (socket) => {
  console.log(`🔌 Socket connected: ${socket.id}`);

  // Worker joins their personal room to receive booking notifications
  socket.on('join-worker', (workerId) => {
    socket.join(`worker:${workerId}`);
    console.log(`Worker ${workerId} joined their room`);
  });

  // User/Worker join a specific booking room for live updates & chat
  socket.on('join-booking', (bookingId) => {
    socket.join(`booking:${bookingId}`);
  });

  // Chat: user sends message inside booking room
  socket.on('send-message', ({ bookingId, sender, text }) => {
    io.to(`booking:${bookingId}`).emit('new-message', {
      sender, text, sentAt: new Date(),
    });
  });

  // Worker location update (live tracking)
  socket.on('location-update', ({ bookingId, lat, lng }) => {
    io.to(`booking:${bookingId}`).emit('worker-location', { lat, lng });
  });

  socket.on('disconnect', () => {
    console.log(`❌ Socket disconnected: ${socket.id}`);
  });
});

// Make io available inside controllers via req.app.get('io')
app.set('io', io);

// ── Core Middleware ───────────────────────────
app.use(cors({ origin: allowedOrigin, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files — uploaded images/documents
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── API Routes ────────────────────────────────
app.use('/api/auth',     require('./routes/authRoutes'));
app.use('/api/users',    require('./routes/userRoutes'));
app.use('/api/workers',  require('./routes/workerRoutes'));
app.use('/api/bookings', require('./routes/bookingRoutes'));
app.use('/api/reviews',  require('./routes/reviewRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));

// Health check
app.get('/api/health', (req, res) =>
  res.json({ status: 'ok', env: process.env.NODE_ENV, time: new Date() })
);

// ── Error Handling ────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Start Server ──────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Sewa API running on port ${PORT} [${process.env.NODE_ENV}]`);
});