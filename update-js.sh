#!/bin/bash
# Helper script to rebuild and deploy JavaScript files to Docker container

set -e

echo "=== Rebuilding JavaScript files ==="
cd UI/WebServerResources
npx grunt uglify:dev

echo ""
echo "=== Copying files to Docker container ==="
JS_SRC=/workspace/UI/WebServerResources/js
JS_DST=/usr/local/lib/GNUstep/SOGo/WebServerResources/js
docker exec sogo_dev sudo cp \
  $JS_SRC/Mailer.js \
  $JS_SRC/Mailer.services.js \
  $JS_SRC/Mailer.app.popup.js \
  $JS_SRC/Common.js \
  $JS_SRC/Main.js \
  $JS_SRC/Scheduler.js \
  $JS_SRC/Scheduler.services.js \
  $JS_SRC/Contacts.js \
  $JS_SRC/Contacts.services.js \
  $JS_SRC/Preferences.js \
  $JS_SRC/Preferences.services.js \
  $JS_SRC/Administration.js \
  $JS_SRC/Administration.services.js \
  $JS_DST/

echo ""
echo "=== Restarting SOGo ==="
docker exec sogo_dev sudo /etc/init.d/sogod stop
docker exec sogo_dev sudo /etc/init.d/sogod start

echo ""
echo "✓ Done! JavaScript files updated successfully."
echo "  Open browser in incognito mode to see changes: http://127.0.0.1/SOGo"
