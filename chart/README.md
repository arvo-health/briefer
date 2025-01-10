# Handling Secrets

## Deps

In order to handle secrets in this chart, helm-secrets plugin and vals (for GCP Secret Manager integration) need to be installed:

> helm-secrets plugin installation: https://github.com/jkroepke/helm-secrets/wiki/Installation

> cloud integration: https://github.com/jkroepke/helm-secrets/wiki/Cloud-Integration

## Using

`helm secrets --backend vals install/upgrade release-name -f values.yaml your-chart -n namespace`

