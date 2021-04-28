# Virtool

[![Build Status](https://cloud.drone.io/api/badges/virtool/virtool/status.svg)](https://cloud.drone.io/virtool/virtool)
[![Codacy Badge](https://app.codacy.com/project/badge/Grade/1388b43207ae407c891744a4d70dde35)](https://www.codacy.com/gh/virtool/virtool?utm_source=github.com&amp;utm_medium=referral&amp;utm_content=virtool/virtool&amp;utm_campaign=Badge_Grade)
[![Codacy Badge](https://app.codacy.com/project/badge/Coverage/1388b43207ae407c891744a4d70dde35)](https://www.codacy.com/gh/virtool/virtool?utm_source=github.com&utm_medium=referral&utm_content=virtool/virtool&utm_campaign=Badge_Coverage)

Virtool is a web-based application for diagnosing viral infections in plant samples using Illumina sequencing. 
  
Website: https://www.virtool.ca  
Gitter: https://gitter.im/virtool

![Virtool Graph Example](./static/graph-example.png)

#### Required Software

| Software                                                            | Version | Use
|:--------------------------------------------------------------------|:--------|:------------------------------------------------|
| [AODP](https://bitbucket.org/wenchen_aafc/aodp_v2.0_release/)       | 2.5.0.1 | Barcode-based amplicon analysis                 |
| [Bowtie2](http://bowtie-bio.sourceforge.net/bowtie2/index.shtml)    | 2.3.2   | Read mapping for known and novel virus analysis |
| [FastQC](https://www.bioinformatics.babraham.ac.uk/projects/fastqc) | 0.11.8  | Read quality analyis                            |
| [FLASH](https://ccb.jhu.edu/software/FLASH/)                        | 1.2.11  | Read joining during amplicon analysis           |
| [HMMER](http://hmmer.org/)                                          | 3.1b2   | Viral motif prediction for novel virus analysis |
| [MongoDB](https://www.mongodb.com/)                                 | 3.6.0   | Backing database                                |
| [Skewer](https://github.com/relipmoc/skewer)                        | 0.2.2   | Read trimming                                   |
| [SPAdes](http://cab.spbu.ru/software/spades/)                       | 3.11.0  | Contig assembly during amplicon analysis        |
