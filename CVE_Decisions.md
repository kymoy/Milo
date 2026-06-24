# CVE Dataset Decisions

## [2026-06-23] CVE high/critical PDF for knowledge library

### Added
- **`make_cve_pdf.py`**: Script that extracts up to 2,500 high/critical CVEs from `cvelistV5-main.zip`, generates a PDF, and saves it to `Test PDFs/real/cve_high_critical.pdf` for ingestion via the Reality mode benchmark panel. Each entry includes the CVE ID, severity label, CVSS base score, up to four affected vendor/product names, and the full English description.

### Notes
- **Severity filter**: Only PUBLISHED CVEs with a CVSS base score ≥ 7.0 (HIGH or CRITICAL) are included. The full CVElistV5 dataset contains ~250,000 entries — filtering to high/critical keeps the knowledge base focused on the CVEs most relevant to real-world risk assessment and most likely to be queried.
- **Full descriptions kept**: Descriptions are not truncated. Milo's RAG pipeline chunks on full sentences, so richer content per entry produces better embeddings and more precise retrieval.
- **Output path is `Test PDFs/real/`**: Placing the PDF here makes it immediately available in the Reality mode benchmark dropdown without any additional steps.
- **2,500-entry cap**: Milo's sustained ingest rate is ~11 chunks/second. At ~4 chunks per CVE, 2,500 entries fits within a 15-minute ingest window (~9,900 chunks). CVEs are sorted by CVSS score descending so the most critical entries are included first if the cap is reached.
