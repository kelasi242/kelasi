# KELASI — Mon épargne, mes projets

Application web progressive (PWA) en français pour suivre des versements hebdomadaires, planifier une épargne sur 104 semaines, organiser des projets personnels et au Congo, et garder un historique manuel du solde de Banque Postale du Congo (BPC).

## Ce qui est inclus

- Tableau de bord récapitulatif et répartition Personnel / Business / Projets Congo.
- Suivi visuel de 104 semaines, du 2 novembre 2026 à la fin du cycle de 104 versements en octobre 2028.
- Montants hebdomadaires libres (décimales admises, zéro possible) ; un versement inférieur à 100 € déclenche seulement un avertissement doux.
- Ajout, modification et suppression de versements et d'objectifs, avec montant affecté manuellement à chaque projet.
- Scénarios d'épargne, graphique indicatif et calculatrice d'objectif / de budget projet.
- Historique de soldes bancaires saisis manuellement, sans identifiants bancaires.
- Mode clair/sombre, export JSON/CSV et restauration d'une sauvegarde JSON.
- PWA avec manifeste et icônes adaptées, cache des fichiers de l'application, installation prise en charge sur mobile et tablette.
- Données conservées localement avec IndexedDB, puis file d'attente de synchronisation cloud au retour de la connexion.
- Authentification e-mail + mot de passe et synchronisation inter-appareils via Supabase lorsque les variables et le schéma sont configurés.

## 1. Lancer en local

Prérequis : Node.js 20+ recommandé et npm.

```bash
npm install
npm run dev
```

Pour tester la version de production et les fonctions PWA :

```bash
npm run build
npm run preview
```

La PWA doit être servie en HTTPS en production (ou via localhost en développement). L'installation native est proposée par les navigateurs compatibles ; sur iPhone/iPad, utiliser le menu Partager puis « Sur l'écran d'accueil ».

## 2. Configurer Supabase (connexion et synchro entre téléphone/tablette)

1. Crée un projet dans [Supabase](https://supabase.com/).
2. Dans **SQL Editor**, exécute le contenu de `supabase/schema.sql`. Les tables disposent de politiques RLS qui limitent chaque utilisateur à ses propres lignes.
3. Dans **Project Settings → API**, copie l'URL du projet et la clé publique `anon` / `publishable`.
4. Copie `.env.example` vers `.env.local` pour un lancement local et renseigne :

```env
VITE_SUPABASE_URL=https://TON-PROJET.supabase.co
VITE_SUPABASE_ANON_KEY=TA_CLE_PUBLIQUE
```

5. Redémarre `npm run dev` après modification du fichier d'environnement.
6. Dans Supabase Auth, vérifie les règles de confirmation d'e-mail et ajoute les URL locales / Netlify autorisées dans les URL de redirection.
7. Crée ton compte KELASI avec ton adresse e-mail et un mot de passe d'au moins 8 caractères. Le mot de passe KELASI est distinct de celui de Banque Postale du Congo (BPC).

**Sécurité :** ne mets jamais une clé Supabase `service_role` dans une variable `VITE_*` ou dans du code client. Utilise uniquement la clé publique avec RLS activé. Ne stocke jamais les identifiants de Banque Postale du Congo (BPC) dans KELASI.

## 3. Déployer sur Netlify

1. Dépose le dossier dans un dépôt Git et connecte-le à Netlify, ou importe le projet dans Netlify.
2. Paramètres de build : commande `npm run build`, dossier publié `dist` (déjà spécifié dans `netlify.toml`).
3. Dans **Site configuration → Environment variables**, crée `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`.
4. Redéploie le site après ajout des variables.
5. Dans Supabase Auth, ajoute l'URL HTTPS de ton site Netlify aux URL de site et de redirection.
6. Ouvre l'URL sur téléphone et tablette, connecte-toi, puis installe KELASI depuis le navigateur. Connecte chaque appareil au même compte pour synchroniser les versements.

## 4. Fonctionnement hors ligne : limites utiles à connaître

- L'application et les données déjà téléchargées sont accessibles hors connexion après un premier chargement réussi.
- La première inscription / première connexion Supabase nécessite Internet. Une session déjà ouverte peut être restaurée depuis le stockage du navigateur, mais son renouvellement ou une nouvelle authentification nécessite une connexion.
- Les versements saisis hors ligne sont conservés sur l'appareil et sont envoyés à Supabase lorsque l'application retrouve le réseau. Ouvre l'application en ligne ensuite pour vérifier le statut de synchronisation.
- Le stockage local du navigateur n'est pas chiffré par KELASI. Protège l'appareil avec son verrouillage et utilise l'authentification Supabase pour les données cloud.
- Les rappels sont déclenchés au lancement de l'application le jour choisi lorsque les notifications navigateur sont autorisées ; ce prototype ne fournit pas de push garanti lorsque l'application est totalement fermée.

## 5. Banque Postale du Congo (BPC)

La page Banque est volontairement en **saisie manuelle** : reporte uniquement le solde observé dans l'application officielle. Le lien bancaire ouvre le site officiel ; il n'y a pas de synchronisation directe du compte dans cette version et KELASI ne demande jamais tes identifiants bancaires. L'écart entre le solde saisi et les versements KELASI est indicatif, car l'application ne connaît pas les autres revenus, retraits, dépenses ni frais.

## 6. Paramètres du plan

- Un plan de 104 versements hebdomadaires est utilisé pour comparer des scénarios.
- À 100 € par semaine, 104 versements représentent **10 400 €**, sans intérêts, frais ou retraits.
- Les budgets initiaux des projets (parcelle, construction, mariage, business, réserve) sont des exemples à modifier selon des devis et la situation locale. Ils ne constituent pas des estimations de prix garanties.

## Sources techniques utiles

- [Supabase Auth — mot de passe](https://supabase.com/docs/guides/auth/passwords)
- [Supabase JavaScript — signInWithPassword](https://supabase.com/docs/reference/javascript/auth-signinwithpassword)
- [MDN — rendre une PWA installable](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)
- [MDN — déclencher l'invite d'installation](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Trigger_install_prompt)

### Migrer les données du mode local

Si tu as commencé à saisir des versements avant de configurer Supabase, exporte une sauvegarde JSON depuis **Réglages → Sauvegarde complète JSON**. Après avoir configuré le cloud et créé ta session, ouvre **Réglages → Restaurer une sauvegarde JSON**. Les éléments seront fusionnés avec ceux du compte connecté.

## Nouveautés v2
- Tableau de bord mensuel (novembre 2026 à novembre 2028), deadlines par projet et montant mensuel requis.
- Dettes avec échéancier automatique, dernier paiement ajusté et validation de chaque mensualité.
- Rappels mensuels configurables et notifications locales à l'ouverture (les notifications push en arrière-plan ne sont pas garanties).
- L'historique des versements hebdomadaires est conservé.

## Version 3.4.0
- Carte de pointage sur 104 semaines, montants hebdomadaires saisis librement (décimales admises, zéro autorisé), total et prévision sur nov. 2026–nov. 2028 recalculés automatiquement.
- Les montants de projets sont librement ajustables ; le total cumulé des budgets et montants affectés est affiché.
- La mise à jour PWA est automatique, avec contrôle au lancement, au retour au premier plan et périodique lorsque l'application reste ouverte.
