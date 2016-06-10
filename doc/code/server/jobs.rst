Jobs
====

.. automodule:: jobs

    .. autodata:: TASK_CLASSES
        :annotation: = {}

    .. autoclass:: Collection

        .. autoinstanceattribute:: jobs_dict
            :annotation: = {}

        .. autoinstanceattribute:: job_classes
            :annotation: = {}

        .. autoinstanceattribute:: used
            :annotation: = {"proc": 0, "mem": 0}

        .. autoattribute:: resources

        .. autoinstanceattribute:: task_counts
            :annotation: = {}

        .. autoinstanceattribute:: queue
            :annotation:

        .. autoinstanceattribute:: _update_queue
            :annotation:

        .. automethod:: sync_processor

        .. automethod:: detail

        .. automethod:: archive

        .. automethod:: cancel

        .. automethod:: remove_job

        .. automethod:: new

        .. automethod:: update

        .. automethod:: _perform_action

        .. automethod:: iterate

        .. automethod:: release_resources

        .. automethod:: resources_available

        .. automethod:: update_status

        .. automethod:: read_log

        .. automethod:: remove_log