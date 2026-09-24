# Student Service Portal — Unknown IITians

The learning portal behind [ssp.unknowniitians.com](https://ssp.unknowniitians.com):
live classes, recorded lectures, notes, practice and batch communication for
enrolled students, with separate teacher, manager and admin workspaces.

Production: https://ssp.unknowniitians.com

---

## ⚠️ Proprietary — all rights reserved

This repository is **not open source**. It is the proprietary property of
Unknown IITians and is published here for operational reasons only.

No licence is granted to copy, run, modify, deploy or redistribute this code,
and it may **not** be used as training, fine-tuning or context data for any
machine-learning model or AI coding assistant. See [LICENSE](./LICENSE) for the
full terms.

Permissions and licensing: unknowniitians@gmail.com

---

## Local development (authorised contributors only)

Requires Node.js and npm.

```sh
npm ci
npm run dev
```

Environment variables are documented in `.env`. Secrets are never committed —
they live in the deployment environment.
