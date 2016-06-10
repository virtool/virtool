Hosts
=====

Hosts are used in Virtool to subtract sequencing reads from analysis that are likely to have originated from the host
genome.

.. automodule:: virtool.hosts

Hosts Collection
----------------

The :class:`.Hosts.Collection` class provides `exposed methods <exposed-methods>`_ for clients to manipulate
hosts in the database.

.. autoclass:: Collection

    .. autoinstanceattribute:: fasta_path
        :annotation:

    .. automethod:: add

    .. automethod:: detail

    .. automethod:: remove_host

    .. automethod:: _remove_host

    .. automethod:: add_stats

    .. automethod:: set_added

    .. automethod:: watch

Adding Hosts
------------

Adding a new host requires that the database be modified, statistics be calculated from the input FASTA file, and a
Bowtie2 index be generated from the FASTA file. The index build can be a long-running process so the :class:`.Job`
subclass :class:`.AddHost` is devoted to this task.

.. autoclass:: AddHost

    .. autoinstanceattribute:: host_id
        :annotation:

    .. autoinstanceattribute:: fasta_path
        :annotation:

    .. autoinstanceattribute:: index_path
        :annotation:

    .. automethod:: mk_host_dir

    .. automethod:: stats

    .. automethod:: stats

    .. automethod:: bowtie_build

    .. automethod:: update_db

    .. automethod:: cleanup

Utility Functions
-----------------

.. autofunction:: get_bowtie2_index_names

