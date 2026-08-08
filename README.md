# Task Manager — CI/CD on Kubernetes

A small Node.js/Express task-tracking API, containerized and deployed through a
Jenkins pipeline to a Kubernetes cluster, with Prometheus and Grafana wired in
for live metrics.

```
┌──────────┐   git push   ┌─────────┐   docker build/push   ┌───────────┐   kubectl apply   ┌────────────┐
│  GitHub  │ ───────────► │ Jenkins │ ─────────────────────► │ DockerHub │ ─────────────────► │ Kubernetes │
└──────────┘              └─────────┘                        └───────────┘                    └────────────┘
                                                                                                      │
                                                                                    MongoDB ◄─────────┤
                                                                              Prometheus/Grafana ◄────┘
```

## Stack

Node.js 18 · Express · MongoDB (Mongoose) · Docker (multi-stage build) ·
Jenkins · Kubernetes · Prometheus · Grafana

## Run locally

```bash
npm install
MONGO_URI=mongodb://localhost:27017/taskdb npm start
# → http://localhost:3000
```

## Run with Docker

```bash
docker build -t task-manager .
docker run -p 3000:3000 -e MONGO_URI=<your-mongo-uri> task-manager
```

## API

| Method | Route            | Description       |
|--------|------------------|--------------------|
| GET    | `/health`        | Liveness/readiness check |
| GET    | `/metrics`       | Prometheus metrics (`http_requests_total` + default Node metrics) |
| GET    | `/api/tasks`     | List all tasks |
| POST   | `/api/tasks`     | Create a task |
| PUT    | `/api/tasks/:id` | Update a task |
| DELETE | `/api/tasks/:id` | Delete a task |

## CI/CD pipeline (Jenkinsfile)

1. **Code Fetch** — pulls `main` from GitHub
2. **Docker Image Creation** — builds the image, tags it with the Jenkins build number and `latest`, pushes both to DockerHub
3. **Kubernetes Deployment** — applies the MongoDB manifest, waits for it to be ready, then applies the app deployment/service and waits for rollout
4. **Prometheus/Grafana Stage** — applies the monitoring stack and waits for both rollouts

The image tag deployed to the cluster is rewritten per-build via `sed` against
`k8s/app-deployment.yaml`, so each pipeline run deploys the image it just built
— not a stale `latest`.

## Kubernetes layout

- `task-manager` — 2 replicas, readiness/liveness probes against `/health`,
  annotated for Prometheus scraping (`/metrics` on port 3000)
- `mongodb` — single replica, headless service, `emptyDir` volume (data does
  **not** persist across pod restarts — see Known Limitations)
- `task-manager-service` — `NodePort`, exposed on `30080`
- `prometheus` / `grafana` — deployed alongside the app for live request
  metrics and dashboards

## Known limitations / next steps

- **MongoDB credentials are hardcoded in plaintext** in
  `k8s/app-deployment.yaml` and `k8s/mongo-deployment.yaml`. These should be
  moved to a Kubernetes `Secret` before this cluster is exposed anywhere
  non-local.
- **MongoDB storage uses `emptyDir`**, so data is lost on pod restart. Swap
  for a `PersistentVolumeClaim` for anything beyond a demo.
- No automated test stage in the Jenkins pipeline yet (lint/unit/integration
  tests would slot in between Code Fetch and Docker Image Creation).

## Files

```
src/app.js               Express API + Prometheus metrics
public/index.html        Static frontend
Dockerfile                Multi-stage build, non-root runtime user
Jenkinsfile               4-stage CI/CD pipeline
k8s/                       Deployment, Service, and monitoring manifests
```
