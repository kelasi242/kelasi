# KELASI — Mon épargne, mes projets

KELASI est une PWA React/Vite en français pour suivre les versements, projets et soldes bancaires saisis manuellement. Les données restent disponibles hors ligne et sont synchronisées avec Supabase après reconnexion lorsqu'un compte est utilisé.

## Développement

```bash
npm install
npm run dev
```

Le navigateur utilise uniquement l'URL Supabase et la clé publique `publishable`/`anon`. Ne jamais exposer une clé `service_role`. La première connexion ou inscription nécessite Internet.

## Confirmation d'e-mail

Pour un usage personnel, si la confirmation empêche la connexion, désactiver **Confirm email** dans **Supabase → Auth → Providers → Email**. Sinon, confirmer le lien reçu avant de se connecter : KELASI affiche un message explicite si l'e-mail n'est pas confirmé.

## Données et hors-ligne

Les données saisies sont conservées localement ; les versements, soldes et projets sont envoyés à Supabase au retour en ligne. Exécuter `SUPABASE_A_EXECUTER.sql` avant d'utiliser la synchronisation cloud.
