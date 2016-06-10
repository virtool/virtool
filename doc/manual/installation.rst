Installation
============

Prerequisites
-------------

The system where the server is installed must have these prerequisites before Virtool will run properly.

* `Linux Operating System <https://www.debian.org/>`_
* `Python 3.4+ <https://www.python.org/>`_
* `MongoDB 3.2.5+ <https://www.mongodb.org/>`_
* `Bowtie2 2.2.8+ <http://bowtie-bio.sourceforge.net/bowtie2>`_
* `Skewer 0.2.2+ <https://sourceforge.net/projects/skewer/>`_
* `FastQC 0.11.5+ <http://www.bioinformatics.babraham.ac.uk/projects/fastqc/>`_

Compatible Browsers
-------------------

Users interact with Virtool almost entirely through a web browser. We recommend Google Chrome or Firefox for best
results. Virtool is also known to work well with Safari. It has not been tested with any version of Internet Explorer
or Microsoft Edge.

Setup
-----

Decompress the Virtool zip file to the installation directory.

If you have a monitor connected to the computer:

 1. Execute the ``run`` file to start the Virtool server.
 2. Open a browser on the server machine and navigate to ``localhost:9650``
 3. You will be taken through a series of steps to set up a new server instance.

If you are installing Virtool on a headless (no monitor) computer:

 1. Open the settings.json file in a text editor.
 2. Find the IP address or hostname of the computer.
 3. Change the JSON object ``{"server_address": "localhost"}`` to ``{"server_address": <hostname>}``.
 4. Execute the `run` file to start the server.
 5. Open a browser on the server machine and navigate to ``<hostname>:9650``
 6. You will be taken through a series of steps to set up a new server instance.

To run Virtool server in the background run the command:

``nohup <run file> &``

*An official init script for Virtool will eventually be released*

