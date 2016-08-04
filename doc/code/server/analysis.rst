Analysis
========

.. automodule:: analysis

    .. autoclass:: Base

        .. autoinstanceattribute:: sample_id
            :annotation:

        .. autoinstanceattribute:: analysis_id
            :annotation:

        .. autoinstanceattribute:: intermediate
            :annotation: = {}

        .. autoinstanceattribute:: results
            :annotation: = {}

        .. automethod:: calculate_read_path


    .. autoclass:: Pathoscope

        .. automethod:: mk_analysis_dir

        .. automethod:: identify_candidate_viruses

        .. automethod:: generate_isolate_fasta

        .. automethod:: pathoscope

