# Guide de déploiement KELASI

1. **Supabase** — Dans le SQL Editor, exécuter tout le fichier `SUPABASE_A_EXECUTER.sql`. Pour un usage personnel, désactiver au besoin **Confirm email** dans **Auth → Providers → Email**.
2. **Netlify** — Déposer `kelasi-dist.zip` dans Netlify Drop, ou connecter le projet `kelasi-netlify-final.zip` à un dépôt Git. La commande `npm run build`, le dossier `dist` et les règles SPA sont déjà configurés.
3. **Téléphone** — Ouvrir l’URL Netlify en HTTPS, se connecter au même compte, puis choisir **Installer** (Android) ou **Partager → Sur l’écran d’accueil** (iPhone/iPad).

## Migration v2
Exécuter `SUPABASE_V2_A_EXECUTER.sql` après le schéma initial, puis déployer `npm run build`. Cette migration ajoute les tables mensuelles, dettes, paiements, réglages et la deadline des projets.
