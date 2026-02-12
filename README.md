# Zawyafi

Repository for the Zawyafi project, organized as a clean multi-part structure.

## Structure

- `docs/`: product, architecture, and deliverables documentation.
- `oracle/`: Chainlink CRE oracle project.
  - `oracle/workflow/`: workflow code and config.
  - `oracle/contracts/`: contract ABIs used by the workflow.
  - `oracle/project.yaml`: CRE project settings.
- `backend/`: backend service workspace (currently scaffolded).
- `frontend/`: frontend app workspace (currently scaffolded).

## Quick Start (Oracle)

1. `cd oracle/workflow`
2. `bun install`
3. Run CRE commands from `oracle/` (where `project.yaml` lives).
