const express    = require('express');
const mongoose   = require('mongoose');
const client     = require('prom-client');
const cors       = require('cors');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Prometheus metrics ────────────────────────────────────────
const register = new client.Registry();
client.collectDefaultMetrics({ register });
const httpCounter = new client.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [register],
});

// ── Middleware ────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use((req, res, next) => {
  res.on('finish', () => {
    httpCounter.inc({ method: req.method, route: req.path, status: res.statusCode });
  });
  next();
});

// ── MongoDB ───────────────────────────────────────────────────
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/taskdb')
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB error:', err));

const Task = mongoose.model('Task', new mongoose.Schema({
  title:     { type: String, required: true },
  completed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
}));

// ── Routes ────────────────────────────────────────────────────
app.get('/health',        (_, res) => res.json({ status: 'ok' }));
app.get('/metrics',       (_, res) => { res.set('Content-Type', register.contentType); register.metrics().then(m => res.end(m)); });
app.get('/api/tasks',     async (_, res) => res.json(await Task.find()));
app.post('/api/tasks',    async (req, res) => { const t = await new Task(req.body).save(); res.status(201).json(t); });
app.put('/api/tasks/:id', async (req, res) => res.json(await Task.findByIdAndUpdate(req.params.id, req.body, { new: true })));
app.delete('/api/tasks/:id', async (req, res) => { await Task.findByIdAndDelete(req.params.id); res.json({ message: 'deleted' }); });

app.listen(PORT, () => console.log(`Task Manager running on port ${PORT}`));
