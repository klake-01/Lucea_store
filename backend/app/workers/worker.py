import asyncio
import os
from temporalio.client import Client
from temporalio.worker import Worker

from app.workers.activities import (
    reconcile_payments_activity,
    resync_search_index_activity,
    database_backup_activity,
    check_low_stock_activity,
)
from app.workers.workflows import (
    PaymentReconciliationWorkflow,
    SearchIndexSyncWorkflow,
    DatabaseBackupWorkflow,
    LowStockAlertWorkflow,
)

async def run_worker():
    temporal_host = os.getenv("TEMPORAL_HOST", "localhost:7233")
    print(f"Connecting Temporal worker to {temporal_host}...")

    client = await Client.connect(temporal_host)
    worker = Worker(
        client,
        task_queue="lucea-tasks",
        workflows=[
            PaymentReconciliationWorkflow,
            SearchIndexSyncWorkflow,
            DatabaseBackupWorkflow,
            LowStockAlertWorkflow,
        ],
        activities=[
            reconcile_payments_activity,
            resync_search_index_activity,
            database_backup_activity,
            check_low_stock_activity,
        ],
    )

    print("Temporal Worker initialized. Listening on queue 'lucea-tasks'...")
    await worker.run()

if __name__ == "__main__":
    asyncio.run(run_worker())
