# Teacher Horizons Hub

Local implementation repository for the placement-points Hub page.

The page is URL-driven and accepts `month-name`, `target-points` and `points`; it does not calculate or verify the underlying placement-points rule.

## Deploy the Hub frontend

The default deployment target for Hub frontend changes is the internal dev38 Hub site:
`https://dev38hub.teacherhorizons.com/`.

Run this from **local Windows in the VS Code Bash terminal**, from this directory:

```bash
cd /c/Users/Administrator/Documents/dev/th/hub
bash ./deploy-dev38hub.sh
```

The script runs the local JavaScript check and Hub tests, then:

1. Copies `app.js`, `styles.css` and `index.html` to Debian dev38 as `peppinckj`.
2. Uses `sudo` on Debian dev38 to install them as root-owned files in `/var/www/th/hub/public`.
3. Prints staged and live SHA-256 hashes for comparison.

The only password prompt is the **Debian sudo password for `peppinckj`**. It is entered into the SSH terminal on the local Windows machine; it is not stored by the script. The SSH private key remains at `C:/Users/Administrator/.ssh/id_ed25519_peppinckj` and is not copied to the server.

The script deploys only the static frontend. Backend/API changes under `hub-ai-chat` require their separate service deployment and restart procedure; they are not changed by this script.

After deployment, hard-refresh the dev38 Hub page and test the changed interaction. A request to change the Hub frontend should be treated as including this dev38 deployment unless a different target or local-only change is explicitly requested.
