from datetime import timedelta
from temporalio import workflow

with workflow.unsafe.imports_passed_through():
    from app.workers.activities import (
        reconcile_payments_activity,
        resync_search_index_activity,
        database_backup_activity,
        check_low_stock_activity,
    )

@workflow.defn
class PaymentReconciliationWorkflow:
    @workflow.run
    async def run(self) -> str:
        return await workflow.execute_activity(
            reconcile_payments_activity,
            schedule_to_close_timeout=timedelta(minutes=5)
        )

@workflow.defn
class SearchIndexSyncWorkflow:
    @workflow.run
    async def run(self) -> str:
        return await workflow.execute_activity(
            resync_search_index_activity,
            schedule_to_close_timeout=timedelta(minutes=10)
        )

@workflow.defn
class DatabaseBackupWorkflow:
    @workflow.run
    async def run(self) -> str:
        return await workflow.execute_activity(
            database_backup_activity,
            schedule_to_close_timeout=timedelta(minutes=15)
        )

@workflow.defn
class LowStockAlertWorkflow:
    @workflow.run
    async def run(self) -> str:
        return await workflow.execute_activity(
            check_low_stock_activity,
            schedule_to_close_timeout=timedelta(minutes=5)
        )
