| Filename       | Format | Description                                                                           |
| -------------- | ------ | ------------------------------------------------------------------------------------- |
| orfs.fa        | fasta  | the expected file containing ORFs expected from ``test_process_fasta``                |
| process_fasta  | pickle | the complete list-based structure expected to be returned from ``test_process_fasta`` | 
| reads_1.fq     | fastq  | left-handed reads for testing paired-end assembly                                     |
| reads_2.fq     | fastq  | right-handed reads for testing paired-end assembly                                    |
| scaffolds_p.fa | fastq  | the SPAdes scaffolds file expected from ``test_assemble`` for paired-end data         |
| scaffolds_u.fa | fastq  | the SPAdes scaffolds file expected from ``test_assemble`` for single-end data         |
| unite.json     | json   | a dict that can be used to create test files for use with ``test_reunite_pairs``      |
| unite.json     | json   | a dict that can be used to create test files for use with ``test_reunite_pairs``      |
