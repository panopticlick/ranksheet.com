.PHONY: deploy down logs validate hadolint trivy-fs trivy-image security-scan

COMPOSE ?= docker compose
COMPOSE_FILE ?= docker-compose.prod.yml
IMAGE_NAME ?= ranksheet-cms:latest

deploy:
	$(COMPOSE) -f $(COMPOSE_FILE) up -d --build

down:
	$(COMPOSE) -f $(COMPOSE_FILE) down

logs:
	$(COMPOSE) -f $(COMPOSE_FILE) logs -f --tail=200

validate:
	$(COMPOSE) -f $(COMPOSE_FILE) config

# Security scanning targets
hadolint:
	@echo "🔍 Running Hadolint (Dockerfile linter)..."
	@command -v hadolint >/dev/null 2>&1 || { echo "❌ Error: hadolint not found. Install: brew install hadolint"; exit 1; }
	@hadolint --config .hadolint.yaml Dockerfile

trivy-fs:
	@echo "🔍 Running Trivy filesystem scan..."
	@command -v trivy >/dev/null 2>&1 || { echo "❌ Error: trivy not found. Install: brew install trivy"; exit 1; }
	@trivy fs --config trivy.yaml --scanners vuln,secret,misconfig .

trivy-image:
	@echo "🔍 Running Trivy image scan..."
	@command -v trivy >/dev/null 2>&1 || { echo "❌ Error: trivy not found. Install: brew install trivy"; exit 1; }
	@echo "⚠️  Building image first..."
	@$(COMPOSE) -f $(COMPOSE_FILE) build cms
	@echo "🔍 Scanning built image..."
	@trivy image --config trivy.yaml ranksheet-cms

security-scan: hadolint trivy-fs
	@echo "✅ Security scan complete!"
	@echo "💡 To scan the built Docker image, run: make trivy-image"
