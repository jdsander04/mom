#!/bin/bash

# run_prod_podman.sh - Script to run the production stack with Podman

set -e

echo "Starting production stack with Podman..."

# Check if podman command exists
if ! command -v podman &> /dev/null; then
    echo "Error: 'podman' not found. Please install Podman."
    exit 1
fi

# Check for podman-compose or use podman compose
if command -v podman-compose &> /dev/null; then
    COMPOSE_CMD="podman-compose"
else
    echo "podman-compose not found, trying 'podman compose'..."
    if podman compose --help &> /dev/null; then
        COMPOSE_CMD="podman compose"
    else
        echo "Error: Neither 'podman-compose' nor 'podman compose' support found."
        echo "Please install podman-compose or ensure your podman version supports 'compose'."
        exit 1
    fi
fi

echo "Using: $COMPOSE_CMD"

# Build and Run
# Note: Podman sometimes needs explicit instruction to build when using compose
echo "Building and starting containers..."
$COMPOSE_CMD -f docker-compose.prod.yml up --build -d

echo "-----------------------------------------------------"
echo "Stack is running!"
echo "Frontend/API available at: http://localhost:8081"
echo "-----------------------------------------------------"
echo "To stop the stack, run: $COMPOSE_CMD -f docker-compose.prod.yml down"
