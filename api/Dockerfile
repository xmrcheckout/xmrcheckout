FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY app /app/app

EXPOSE 8000

CMD ["/bin/sh", "-c", "gunicorn app.main:app -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000 -w ${GUNICORN_WORKERS:-2}"]
