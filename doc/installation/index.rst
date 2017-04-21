============
Installation
============


System Requirements
-------------------

We recommend the following minimum specifications for serving Virtool.

- Linux operating system
- 32 GB RAM
- 1 TB fast storage
- 1 Gb network connection

Higher CPU clock speeds and core counts will allow more operations to be run in parallel.


Clients
~~~~~~~

Clients don't require any extraordinary computing power. Use a modern evergreen browser such as Chrome, Firefox,
Safari, or Edge.

Internal Explorer **is not** supported at this time.


Installing Virtool
------------------

Before you can start using Virtool, it must be installed on your system.

1. Download the latest Virtool distributable either the `Virtool website <http://www.virtool.ca>`_ or at the
   `Virtool releases page <https://github.com/virtool/virtool/releases>`_.

2. Unpack the downloaded archive using your graphical archive manager or by issuing the following command::

    tar -xvf virtool.tar.gz

3. Move to the unpacked directory by issuing the following command::

    cd virtool

4. Start the install process by issuing the following command::

    sh install.sh

5. Install :ref:`MongoDB <mongo-db>` and the required :ref:`external software <external-software>` **before** starting
   Virtool.


.. _mongo-db:

MongoDB
-------

Virtool uses MongoDB v3.4.0+ for databasing. You will have to download and install MongoDB before starting Virtool. We
highly recommend installing and updating MongoDB through your Linux package manager.

The MongoDB documentation provides step-by-step instructions for installing MongoDB on common Linux distributions:

- `Install on Ubuntu <https://docs.mongodb.com/manual/tutorial/install-mongodb-on-ubuntu/>`_
- `Install on Debian <https://docs.mongodb.com/manual/tutorial/install-mongodb-on-debian/>`_
- `Install on SUSE <https://docs.mongodb.com/manual/tutorial/install-mongodb-on-suse/>`_
- `Install on Red Hat <https://docs.mongodb.com/manual/tutorial/install-mongodb-on-red-hat/>`_

Once you have installed MongoDB, ensure it is running by issuing the following command:

.. code-block:: sh

    sudo service mongod status


You will receive output similar to the following if MongoDB is running:

::

    ● mongod.service - High-performance, schema-free document-oriented database
       Loaded: loaded (/etc/systemd/system/mongod.service; disabled; vendor preset: enabled)
       Active: active (running) since Fri 2017-04-21 15:55:59 PDT; 2s ago
     Main PID: 11844 (mongod)
        Tasks: 14
       Memory: 31.1M
          CPU: 95ms
       CGroup: /system.slice/mongod.service
               └─11844 /usr/bin/mongod --quiet --config /etc/mongod.conf


.. _external-software:

External Software
-----------------

Virtool relies on a number of common bioinformatics programs. These should be available in your ``PATH`` so Virtool can
find them.

.. warning::

    Virtool does not currently ensure that these programs are available in ``PATH``. You will encounter errors if
    they are not properly installed.


+------------------------------------------------------------------------+-------------+--------------------------------------------------+
| Name                                                                   | Version     | Purpose                                          |
+========================================================================+=============+==================================================+
| `Skewer <https://github.com/relipmoc/skewer>`_                         | 0.2.2       | Read trimming and quality control                |
+------------------------------------------------------------------------+-------------+--------------------------------------------------+
| `FastqQC <http://www.bioinformatics.babraham.ac.uk/projects/fastqc/>`_ | v0.11.5+    | Calculating quality metrics for sample libraries |
+------------------------------------------------------------------------+-------------+--------------------------------------------------+
| `Bowtie2 <http://bowtie-bio.sourceforge.net/bowtie2/index.shtml>`_     | 2.2.9+      | High-throughput read alignment                   |
+------------------------------------------------------------------------+-------------+--------------------------------------------------+
| `SNAP Aligner <http://snap.cs.berkeley.edu/>`_                         | 1.0beta.18+ | High-throughput read alignment                   |
+------------------------------------------------------------------------+-------------+--------------------------------------------------+
| `SPAdes <http://bioinf.spbau.ru/spades>`_                              | v3.8.1+     | De novo assembly                                 |
+------------------------------------------------------------------------+-------------+--------------------------------------------------+
| `HMMER <http://hmmer.org/>`_                                           | 3.1b2       | Motif detection                                  |
+------------------------------------------------------------------------+-------------+--------------------------------------------------+

Installing Skewer
~~~~~~~~~~~~~~~~~

1. `Download the source code <https://github.com/relipmoc/skewer/releases>`_ for the latest Skewer release.
2. Unpack the archive by issuing the following command::

    tar -xvf <skewer-src>.tar.gz

3. Move into the unpacked directory by issuing the following command::

    cd <skewer-src>

4. Build the skewer binary by issuing the following command::

    make

5. Move the binary to a directory that is in ``PATH``. For example: ::

    mv skewer /usr/local/bin


6. Ensure that ``skewer`` is in ``PATH`` by issuing the following command::

    skewer

   You should see the following output: ::

    skewer (0.2.2): No input file specified

    Usage: skewer [options] <file> [file2]
    Try `skewer --help' for more information.


Installing FastQC
~~~~~~~~~~~~~~~~~

1. `Download the FastQC Win/Linux binaries <http://www.bioinformatics.babraham.ac.uk/projects/download.html#fastqc>`_.
2. Hello
