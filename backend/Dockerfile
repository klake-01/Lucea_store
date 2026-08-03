FROM python:3.12-slim
WORKDIR /app

# DejaVu is needed by the order PDF: customer names and addresses contain
# accents, and the built in Helvetica renders those as empty boxes.
RUN apt-get update  && apt-get install -y --no-install-recommends fonts-dejavu-core  && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
