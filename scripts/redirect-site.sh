#!/usr/bin/env bash
# Turn an old GitHub Pages site into a redirect to its new address, keeping the
# rest of the path, the query and the hash (so /old/try/?embed=1 lands on
# /new/try/?embed=1). Every old file goes; index.html and 404.html both redirect,
# so any old link works.
#   scripts/redirect-site.sh CHECKOUT OLD_PREFIX NEW_URL NAME
#   scripts/redirect-site.sh ~/Playground/ready-set-web /ready-set-web/ https://swwallowws.github.io/ready-set/ "Ready Set"
set -euo pipefail
checkout="${1:?checkout}"; old="${2:?old prefix}"; new="${3:?new url}"; name="${4:?name}"

find "$checkout" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
page=$(cat <<HTML
<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${name} has moved</title>
<link rel="canonical" href="${new}">
<script>
  var rest = location.pathname.indexOf('${old}') === 0 ? location.pathname.slice('${old}'.length) : '';
  location.replace('${new}' + rest + location.search + location.hash);
</script>
<p>${name} has moved to <a href="${new}">${new}</a>.</p>
</html>
HTML
)
printf '%s\n' "$page" > "$checkout/index.html"
printf '%s\n' "$page" > "$checkout/404.html"
printf '# %s has moved\n\nThe site now lives at %s, built from its own repository.\n' "$name" "$new" > "$checkout/README.md"
touch "$checkout/.nojekyll"
echo "redirect staged in $checkout"
