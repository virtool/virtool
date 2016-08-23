Analysis
========

.. automodule:: analysis

    .. autoclass:: Base
        :show-inheritance:

        .. autoinstanceattribute:: sample_id
            :annotation:

        .. autoinstanceattribute:: analysis_id
            :annotation:

        .. autoinstanceattribute:: intermediate
            :annotation: = {}

        .. autoinstanceattribute:: results
            :annotation: = {}

        .. automethod:: calculate_read_path

        .. automethod:: cleanup


    .. autoclass:: Pathoscope
        :show-inheritance:

        .. automethod:: mk_analysis_dir

        .. automethod:: identify_candidate_viruses

        .. automethod:: generate_isolate_fasta

        .. automethod:: subtract_virus_mapping

        .. automethod:: pathoscope


    .. autoclass:: PathoscopeBowtie
        :show-inheritance:

        .. automethod:: map_viruses

        .. automethod:: build_isolate_index

        .. automethod:: map_isolates

        .. automethod:: map_host


    .. autoclass:: PathoscopeSNAP
        :show-inheritance:

        .. automethod:: map_viruses

        .. automethod:: build_isolate_index

        .. automethod:: map_isolates

        .. automethod:: save_mapped_reads

        .. automethod:: map_host


    .. autoclass:: NuVs
        :show-inheritance:

        .. automethod:: map_viruses

        .. automethod:: map_host

        .. automethod:: assemble

        .. automethod:: process_fasta

        .. automethod:: vfam

        .. automethod:: import_results

