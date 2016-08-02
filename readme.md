Virtool
=========

Virtool is a web-based application for diagnosing viral infections in plant samples using Illumina sequencing. Some of
its features are:

  - Real-time communication between clients and the server using WebSockets
  - A simple job management system
  - Quality control of Illumina data
  - Fast identification of known viruses based on read alignment and statistical analysis
  - Prediction of novel viral sequences in sample libraries based on assembly and profile hidden Markov models

Dependencies
------------

- MongoDB
- FastQC
- Skewer
- Bowtie2
- SNAP
- SPAdes
- HMMER


Python Modules
----

- [Tornado](http://www.tornadoweb.org)
- [Motor](https://github.com/mongodb/motor)
- [Biopython](http://biopython.org/)
- [matplotlib](http://matplotlib.org/)
- [psutil](https://github.com/giampaolo/psutil)
- [python-magic](https://github.com/ahupp/python-magic)
- [setproctitle](https://github.com/dvarrazzo/py-setproctitle)


JS Libraries
----

- React
- React-Bootstrap
- Lodash
- Moment
- Numeral
- d3
- d3-svg-legend
- bowser
- classnames
- react-cookie
- react-bootstrap
- react-dropzone
- superagent

CSS Frameworks
----
- Bootstrap

Running Virtool
---------------
Development copy:

`python run.py --dev`

Built copy:

`run`