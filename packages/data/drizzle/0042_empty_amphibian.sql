ALTER TABLE "otu_local_sequence_records" ADD COLUMN "source" text NOT NULL;--> statement-breakpoint
ALTER TABLE "otu_local_sequence_records" ADD COLUMN "accession_version" text;--> statement-breakpoint
ALTER TABLE "otu_sequences" ADD COLUMN "accession_base" text;--> statement-breakpoint
ALTER TABLE "otu_sequences" ADD COLUMN "retired_version" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "otu_sequences_current_accession_key" ON "otu_sequences" USING btree ("otu_id","accession_base") WHERE "otu_sequences"."accession_base" is not null and "otu_sequences"."retired_version" is null;--> statement-breakpoint
ALTER TABLE "otu_local_sequence_records" ADD CONSTRAINT "otu_local_sequence_records_source_check" CHECK (("otu_local_sequence_records"."source" = 'manual' and "otu_local_sequence_records"."accession_version" is null) or ("otu_local_sequence_records"."source" = 'genbank' and "otu_local_sequence_records"."accession_version" is not null));--> statement-breakpoint
ALTER TABLE "otu_sequences" ADD CONSTRAINT "otu_sequences_retired_version_check" CHECK ("otu_sequences"."retired_version" is null or "otu_sequences"."retired_version" >= 2);