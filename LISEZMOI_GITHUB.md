# Déploiement KELASI v3

1. Dans le dépôt GitHub, remplacer les fichiers par ceux de cette archive (conserver le dépôt et le projet Supabase existants).
2. Faire `git add . && git commit -m "Déployer Kelasi v3" && git push`.
3. Dans Supabase SQL Editor, exécuter **une seule fois** `SUPABASE_UNIQUE_A_EXECUTER.sql`. Ce script est additif/idempotent et ne supprime aucune donnée v1/v2.
4. Dans Netlify, vérifier le dépôt et les variables `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (les valeurs par défaut sont déjà celles du projet Kelasi).

Netlify construit avec `npm run build` et publie `dist`. Le service worker v3 se met à jour automatiquement.
