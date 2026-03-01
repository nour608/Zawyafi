# Zawyafi

Repository for the Zawyafi project, organized as a clean multi-part structure.

## Structure

- `docs/`: product, architecture, and deliverables documentation.
- `oracle/`: Chainlink CRE oracle project.
  - `oracle/square-workflow/`: Square revenue workflow.
  - `oracle/kyc-settlement-workflow/`: KYC onchain settlement workflow.
  - `oracle/compliance-export-workflow/`: Compliance report export workflow.
  - `oracle/project.yaml`: CRE project settings.
- `backend/`: core backend for KYC orchestration and API gateway.
- `square-testing-cafe-integration/`: Square sandbox/testing backend.
- `frontend/`: frontend app workspace.

## Quick Start (Oracle)

1. `cd oracle/square-workflow`
2. `bun install`
3. Run CRE commands from `oracle/` (where `project.yaml` lives).
