# Two stages: build the Mini App bundle with Node, then run the API + bot on
# a Python image that already carries the built assets.
#
# The dependencies live in a venv that is FIRST on PATH, so `python` and
# `/opt/venv/bin/python` are the same interpreter. That is deliberate: Railway
# can take its start command from several places (a Procfile, a custom start
# command in the dashboard, this CMD), and every spelling has to find the
# dependencies. A venv reachable only by absolute path did not survive that.

FROM node:20-slim AS frontend
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.11-slim
ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

WORKDIR /app
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend/ backend/
# config.py resolves the static dir relative to the repo root, so the built
# bundle has to keep its frontend/dist place next to backend/.
COPY --from=frontend /build/dist frontend/dist

WORKDIR /app/backend
CMD ["python", "run.py"]
