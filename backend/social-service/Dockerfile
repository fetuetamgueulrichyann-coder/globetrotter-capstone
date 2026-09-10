FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 5004
CMD ["gunicorn", "--bind", "0.0.0.0:5004", "--workers", "2", "--access-logfile", "-", "run:app"]
