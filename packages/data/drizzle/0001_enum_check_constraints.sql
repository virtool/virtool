ALTER TABLE "analysis_files" ALTER COLUMN "format" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "subtraction_files" ALTER COLUMN "type" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "analysis_files" ADD CONSTRAINT "ck_analysis_files_format" CHECK ("analysis_files"."format" in ('sam', 'bam', 'fasta', 'fastq', 'csv', 'tsv', 'json'));--> statement-breakpoint
ALTER TABLE "subtraction_files" ADD CONSTRAINT "ck_subtraction_files_type" CHECK ("subtraction_files"."type" in ('fasta', 'bowtie2'));--> statement-breakpoint
DROP TYPE "public"."analysisformat";--> statement-breakpoint
DROP TYPE "public"."subtractiontype";