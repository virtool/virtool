Samples
=======

.. automodule:: virtool.samples

    .. autoclass:: Collection

        .. autoinstanceattribute:: excluded_files
            :annotation: = []

        .. autoinstanceattribute:: analyses_collection


Dispatching
-----------

Sample documents include read and write permissions to control who can have access to sample data. Updates and sync
operations for a given sample document should not be dispatched to connections that do not have the right to read the
sample. Additionally sample documents should be removed from clients that lose read rights when they already have the
document from a previous sync.

Some superclass methods are redefined to sync documents and dispatch updates only to connection with the appropriate
read rights for the document.

.. automethod:: virtool.samples.Collection.sync_processor

.. automethod:: virtool.samples.Collection.dispatch


Creating Samples
----------------

Clients can create samples by calling the :ref:`exposed method <exposed-methods>` :meth:`~.samples.Collection.new`.

.. automethod:: virtool.samples.Collection.new

Calling :meth:`.analyze`. starts an :class:`.ImportReads` job. While the job is running, it generates sample quality
data from the read files using FastQC. This quality data is pushed to the database by the running job using
:meth:`~.samples.Collection.set_stats`.

.. automethod:: virtool.samples.Collection.set_stats

Files available for creating new samples are stored in the Virtool *watch path*. The contents of the watch folder are
constantly kept in sync with listening clients using the :meth:`~.samples.Collection.watch` method.

.. automethod:: virtool.samples.Collection.watch


The ImportReads Job
~~~~~~~~~~~~~~~~~~~

.. autoclass:: virtool.samples.ImportReads

    .. autoinstanceattribute:: sample_id
        :annotation:

    .. autoinstanceattribute:: files
        :annotation: = []

    .. autoinstanceattribute:: paired
        :annotation:

    .. autoinstanceattribute:: sample_path
        :annotation:

    .. autoinstanceattribute:: stage_list
        :annotation: = []

    .. automethod:: mk_sample_dir

    .. automethod:: import_files

    .. automethod::


Modifying Samples
-----------------

Clients can modify certain fields in sample document after it has been imported successfully. This functionality is
exposed in :meth:`~.samples.Collection.set_field`.

.. automethod:: virtool.samples.Collection.set_field

The owner group and rights of a sample document can be changed after it has been created.

.. automethod:: virtool.samples.Collection.set_group

.. automethod:: virtool.samples.Collection.set_rights

Samples can be archived. This currently does have any real effect other than organizing the sample documents. In the
future, archiving samples may result in the deletion of unnecessary data from the sample directory and the compression
of the read data.

.. automethod:: virtool.samples.Collection.archive


Removing Samples
----------------

.. automethod:: virtool.samples.Collection._remove_samples

.. automethod:: virtool.samples.Collection.remove_sample


Analyses
--------

Clients can start analyses by calling the :ref:`exposed method <exposed-methods>` :meth:`.analyze`.

.. automethod:: virtool.samples.Collection.analyze

When the analysis job is almost complete, it will push its result to the analysis collection
:attr:`.analyses_collection` by calling :meth:`.set_analysis`.

.. automethod:: virtool.samples.Collection.set_analysis

Removing an analysis requires modifying the samples and analyses collections and removing the analysis data from the
filesystem. This is done by calling :meth:`_remove_analysis`. The exposed method :meth:`.remove_analysis`.

.. automethod:: virtool.samples.Collection._remove_analysis

.. automethod:: virtool.samples.Collection.remove_analysis


Retrieving Data
---------------



.. automethod:: virtool.samples.Collection._detail

.. automethod:: virtool.samples.Collection.parse_detail

.. automethod:: virtool.samples.Collection.detail

.. automethod:: virtool.samples.Collection.quality_pdf



