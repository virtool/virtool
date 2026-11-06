---
virtool: patch
---

Fix small problems in the Nuvs analysis view

The link to a running BLAST search now has the correct address. Sequences show
"1 ORF" in place of "1 ORFs", and sequences with no HMM hits no longer show an
empty E-value. Exported Nuvs files now have an underscore in place of every
space in the sample name. The HMM alert now uses the name "Nuvs".
