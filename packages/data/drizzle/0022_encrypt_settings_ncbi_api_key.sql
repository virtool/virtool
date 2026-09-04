-- The NCBI API key moves from plaintext text to the encrypted jsonb envelope
-- every other stored credential uses.
--
-- Dropped and re-added rather than cast in place. A plaintext key is not valid
-- jsonb, and only the process encryption key can produce an envelope, which no
-- SQL statement holds. The stored key is therefore discarded and an
-- administrator enters it again; null is "no key stored", which is the same
-- state a deployment that never configured one was already in.
ALTER TABLE "settings" DROP COLUMN "ncbi_api_key";--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "ncbi_api_key" jsonb;
