#!/bin/bash
# Helper script to rebuild and deploy JavaScript files to Docker container

set -e

echo "=== Rebuilding JavaScript files ==="
cd UI/WebServerResources
npx grunt uglify:dev

echo ""
echo "=== Copying files to Docker container ==="
docker exec sogo_dev sudo cp /workspace/UI/WebServerResources/js/Mailer.services.js /usr/local/lib/GNUstep/SOGo/WebServerResources/js/Mailer.services.js

echo ""
echo "=== Restarting SOGo ==="
docker exec sogo_dev sudo /etc/init.d/sogod restart

echo ""
echo "✓ Done! JavaScript files updated successfully."
echo "  Open browser in incognito mode to see changes: http://127.0.0.1/SOGo"
