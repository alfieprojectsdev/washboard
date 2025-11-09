#!/bin/bash

# Screenshot Capture Runner Script
# Starts the dev server in screenshot mode and runs the capture script

set -e

echo "========================================="
echo "Washboard Screenshot Capture Runner"
echo "========================================="

# Check if dev server is already running
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
  echo "✓ Dev server already running on port 3000"
  DEV_SERVER_PID=""
else
  echo "Starting dev server..."
  WASHBOARD_SCREENSHOT_MODE=true npm run dev &
  DEV_SERVER_PID=$!
  echo "✓ Dev server started (PID: $DEV_SERVER_PID)"

  # Wait for server to be ready
  echo "Waiting for server to become ready..."
  for i in {1..30}; do
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
      echo "✓ Server is ready"
      break
    fi
    echo "  Attempt $i/30..."
    sleep 1
  done
fi

# Run the capture script with screenshot mode enabled
echo ""
echo "Running screenshot capture..."
WASHBOARD_SCREENSHOT_MODE=true node scripts/capture-screenshots.js

# Clean up dev server if we started it
if [ -n "$DEV_SERVER_PID" ]; then
  echo ""
  echo "Cleaning up dev server..."
  kill $DEV_SERVER_PID 2>/dev/null || true
fi

echo ""
echo "✓ Screenshot capture complete!"
