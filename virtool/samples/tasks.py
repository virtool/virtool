from virtool.tasks.task import BaseTask


class SampleWorkflowsUpdateTask(BaseTask):
    """Updates workflows, nuvs, and pathoscoope fields for samples"""

    name = "update_sample_workflows"

    def __init__(self, task_id, data, context, temp_dir):
        super().__init__(task_id, data, context, temp_dir)
        self.steps = [self.update_sample_workflows]

    async def update_sample_workflows(self):
        await self.data.samples.update_sample_workflows()
