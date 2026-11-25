.PHONY: setup data dev build test lint

PYTHON ?= $(if $(wildcard .venv/bin/python),.venv/bin/python,python3)

setup:
	python3 -m venv .venv
	pnpm install --frozen-lockfile

data:
	$(PYTHON) -m iwa.cli refresh

dev:
	python3 scripts/dev.py

build:
	pnpm build

test:
	$(PYTHON) -m unittest discover -s tests -v

lint:
	$(PYTHON) -m compileall -q iwa pipelines tests
	pnpm typecheck

